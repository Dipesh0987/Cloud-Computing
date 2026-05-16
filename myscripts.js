// myscripts.js - fixed save/cancel buttons and improved messages
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXxhQ8aQ55x30CUgv_-FCOfmf7_et0Yhk",
  authDomain: "moviereview-2510302.firebaseapp.com",
  projectId: "moviereview-2510302",
  storageBucket: "moviereview-2510302.firebasestorage.app",
  messagingSenderId: "713603471299",
  appId: "1:713603471299:web:e58d8e7712d7cfc6aa4f76"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let currentData = [];
let currentSortOrder = "asc";
let editingRowId = null;

// Helper function to show toast notifications
function showToast(message, isError = false) {
  // Remove any existing toasts
  $('.toast-notification').remove();
  
  const toast = $('<div>')
    .addClass('toast-notification' + (isError ? ' error' : ''))
    .html('<i class="fas ' + (isError ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + message)
    .appendTo('body');
  
  setTimeout(() => {
    toast.fadeOut(300, () => toast.remove());
  }, 3000);
}

// Helper function to format release date
function formatReleaseDate(dateValue) {
  if (!dateValue) return "Not set";
  if (dateValue.toDate) {
    const d = dateValue.toDate();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  if (typeof dateValue === 'string') {
    const d = new Date(dateValue);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  return "Invalid date";
}

// Helper function to get date value for input fields
function getDateValue(timestamp) {
  if (!timestamp) return '';
  if (timestamp.toDate) {
    const date = timestamp.toDate();
    return date.toISOString().split('T')[0];
  }
  if (typeof timestamp === 'string') {
    return timestamp.split('T')[0];
  }
  return '';
}

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Render the table with current data based on sort order
function renderTable() {
  if (!currentData || currentData.length === 0) {
    $('#reviewList').html(`
      <tr>
        <td colspan="5" class="text-center text-muted">No reviews yet. Add your first movie!</td>
      </tr>
    `);
    $('#mainTitle').html("My Movies (0)");
    return;
  }

  // Sort data based on current order
  let sortedData = [...currentData];
  if (currentSortOrder === "asc") {
    sortedData.sort((a, b) => (a.movie_name || "").localeCompare(b.movie_name || ""));
  } else {
    sortedData.sort((a, b) => (b.movie_name || "").localeCompare(a.movie_name || ""));
  }

  // Build table rows
  let tableRows = '';
  sortedData.forEach((doc) => {
    if (editingRowId === doc.id) {
      // Render edit mode row
      tableRows += `
        <tr id="row-${doc.id}" class="editing-row">
          <td>
            <input type="text" class="inline-edit-input" id="edit-name-${doc.id}" value="${escapeHtml(doc.movie_name || '')}">
          </td>
          <td>
            <select class="inline-edit-select" id="edit-rating-${doc.id}">
              <option value="1" ${doc.rating == 1 ? 'selected' : ''}>1/5</option>
              <option value="2" ${doc.rating == 2 ? 'selected' : ''}>2/5</option>
              <option value="3" ${doc.rating == 3 ? 'selected' : ''}>3/5</option>
              <option value="4" ${doc.rating == 4 ? 'selected' : ''}>4/5</option>
              <option value="5" ${doc.rating == 5 ? 'selected' : ''}>5/5</option>
            </select>
          </td>
          <td>
            <input type="text" class="inline-edit-input" id="edit-director-${doc.id}" value="${escapeHtml(doc.director || '')}" placeholder="Director name">
          </td>
          <td>
            <input type="date" class="inline-edit-input" id="edit-date-${doc.id}" value="${getDateValue(doc.release_date)}">
          </td>
          <td>
            <button class="save-btn" onclick="window.saveEdit('${doc.id}')">Save</button>
            <button class="cancel-btn" onclick="window.cancelEdit()">Cancel</button>
          </td>
         </tr>
      `;
    } else {
      // Render normal view mode row
      tableRows += `
        <tr id="row-${doc.id}">
          <td><strong>${escapeHtml(doc.movie_name || '')}</strong></td>
          <td>${doc.rating || 0}/5</td>
          <td>${escapeHtml(doc.director || 'Not set')}</td>
          <td>${formatReleaseDate(doc.release_date)}</td>
          <td>
            <button class="edit-btn" onclick="window.editMovie('${doc.id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="window.deleteMovie('${doc.id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
           </td>
         </tr>
      `;
    }
  });
  
  $('#reviewList').html(tableRows);
  $('#mainTitle').html(`My Movies (${currentData.length})`);
}

// Load data from Firestore
const q = query(collection(db, "Movie Reviews"), orderBy("movie_name"));
const unsubscribe = onSnapshot(q, (snapshot) => {
  $('#reviewList').empty();
  
  // Store data in array
  currentData = [];
  snapshot.forEach((doc) => {
    currentData.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  // Clear editing mode when data refreshes
  editingRowId = null;
  
  // Render the table with current sort
  renderTable();
  
  // Display review count
  $('#mainTitle').html(currentData.length + " Movie reviews in the list");
});

// Add movie function with director and release date
window.addMovie = async function() {
  const movieName = $('#movie_name').val().trim();
  const rating = $('#rating').val();
  const director = $('#director').val().trim();
  const releaseDateRaw = $('#release_date').val();
  
  if (!movieName) {
    showToast("Please enter a movie name", true);
    return;
  }
  
  try {
    let releaseTimestamp = null;
    if (releaseDateRaw) {
      releaseTimestamp = Timestamp.fromDate(new Date(releaseDateRaw));
    }
    
    await addDoc(collection(db, "Movie Reviews"), {
      movie_name: movieName,
      rating: parseInt(rating),
      director: director || "",
      release_date: releaseTimestamp
    });
    
    // Clear inputs
    $('#movie_name').val('');
    $('#director').val('');
    $('#release_date').val('');
    $('#rating').val('3');
    
    showToast(`"${movieName}" has been added to your collection!`);
  } catch (error) {
    console.error("Error adding movie:", error);
    showToast("Failed to add movie. Please try again.", true);
  }
};

// Edit movie function
window.editMovie = function(docId) {
  editingRowId = docId;
  renderTable();
};

// Save edit function
window.saveEdit = async function(docId) {
  const newName = $(`#edit-name-${docId}`).val().trim();
  const newRating = parseInt($(`#edit-rating-${docId}`).val());
  const newDirector = $(`#edit-director-${docId}`).val().trim();
  const newDateRaw = $(`#edit-date-${docId}`).val();
  
  if (!newName) {
    showToast("Movie name cannot be empty", true);
    return;
  }
  
  try {
    let newTimestamp = null;
    if (newDateRaw) {
      newTimestamp = Timestamp.fromDate(new Date(newDateRaw));
    }
    
    await updateDoc(doc(db, "Movie Reviews", docId), {
      movie_name: newName,
      rating: newRating,
      director: newDirector || "",
      release_date: newTimestamp
    });
    
    // Clear editing mode BEFORE showing toast
    editingRowId = null;
    
    // Show success message
    showToast(`"${newName}" has been updated successfully!`);
    
    // Re-render will happen automatically from onSnapshot
  } catch (error) {
    console.error("Error updating movie:", error);
    showToast("Failed to update movie. Please try again.", true);
  }
};

// Cancel edit function
window.cancelEdit = function() {
  editingRowId = null;
  renderTable();
  showToast(`Edit cancelled`, false);
  setTimeout(() => {
    $('.toast-notification').fadeOut(300, () => $('.toast-notification').remove());
  }, 1500);
};

// Delete movie function
window.deleteMovie = async function(docId) {
  const movie = currentData.find(m => m.id === docId);
  const movieName = movie ? movie.movie_name : "this movie";
  
  if (confirm(`Are you sure you want to delete "${movieName}"?`)) {
    try {
      await deleteDoc(doc(db, "Movie Reviews", docId));
      showToast(`"${movieName}" has been removed from your collection.`);
    } catch (error) {
      console.error("Error deleting movie:", error);
      showToast("Failed to delete movie. Please try again.", true);
    }
  }
};

// Sort functionality
let sortAscending = true;
$('#sortButton').on('click', function() {
  sortAscending = !sortAscending;
  currentSortOrder = sortAscending ? "asc" : "desc";
  
  // Clear any editing mode when sorting
  editingRowId = null;
  
  renderTable();
  
  // Update button text and icon
  const button = $(this);
  if (sortAscending) {
    button.html('<i class="fas fa-sort-alpha-down"></i> Sort A-Z');
    button.removeClass('active');
    showToast(`Movies sorted A to Z`);
  } else {
    button.html('<i class="fas fa-sort-alpha-up"></i> Sort Z-A');
    button.addClass('active');
    showToast(`Movies sorted Z to A`);
  }
  
  setTimeout(() => {
    $('.toast-notification').fadeOut(300, () => $('.toast-notification').remove());
  }, 1500);
});

// Attach add button click handler
$('#addButton').on('click', window.addMovie);

// Allow Enter key to add movie from any input field
$('#movie_name, #director, #release_date').on('keypress', function(e) {
  if (e.which === 13) {
    window.addMovie();
  }
});