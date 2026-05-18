import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  collection, getFirestore, onSnapshot, query, orderBy,
  addDoc, deleteDoc, updateDoc, doc, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAXxhQ8aQ55x30CUgv_-FCOfmf7_et0Yhk",
  authDomain: "moviereview-2510302.firebaseapp.com",
  projectId: "moviereview-2510302",
  storageBucket: "moviereview-2510302.firebasestorage.app",
  messagingSenderId: "713603471299",
  appId: "1:713603471299:web:e58d8e7712d7cfc6aa4f76"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentData = [];
let editingRowId = null;
let deleteConfirmId = null;

// Sort state: which field and which direction
let sortField = "movie_name";
let sortDir = "asc"; // "asc" or "desc"

// ── Toast ──────────────────────────────────────────────
function showToast(message, isError = false) {
  $('.toast-notification').remove();
  const icon = isError ? 'fa-exclamation-circle' : 'fa-check-circle';
  $('<div>')
    .addClass('toast-notification' + (isError ? ' error' : ''))
    .html(`<i class="fas ${icon}"></i> ${message}`)
    .appendTo('body');
  setTimeout(() => {
    $('.toast-notification').fadeOut(300, function() { $(this).remove(); });
  }, 3000);
}

// ── Date helpers ───────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString('en-AU'); // dd/mm/yyyy
}

function toInputDate(val) {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return '';
  return d.toISOString().split('T')[0];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Sort helpers ───────────────────────────────────────
function getSortValue(doc, field) {
  if (field === 'rating') return Number(doc.rating) || 0;
  if (field === 'release_date') {
    if (!doc.release_date) return 0;
    const d = doc.release_date.toDate ? doc.release_date.toDate() : new Date(doc.release_date);
    return isNaN(d) ? 0 : d.getTime();
  }
  return (doc[field] || '').toLowerCase();
}

function sortData(data) {
  return [...data].sort((a, b) => {
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);
    let cmp = 0;
    if (typeof va === 'number') {
      cmp = va - vb;
    } else {
      cmp = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

// ── Update sort dropdown UI ────────────────────────────
const sortLabels = {
  movie_name: 'A-Z',
  director: 'Director',
  release_date: 'Date',
  rating: 'Rating'
};

function updateSortUI() {
  $('#sortLabel').text(sortLabels[sortField]);
  const icon = $('#sortDirIcon');
  icon.removeClass('fa-arrow-up fa-arrow-down');
  icon.addClass(sortDir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down');
  $('.sort-option').removeClass('selected');
  $(`.sort-option[data-sort="${sortField}"]`).addClass('selected');
}

// ── Render table ───────────────────────────────────────
function renderTable() {
  if (!currentData.length) {
    $('#reviewList').html(`
      <tr><td colspan="5" class="text-center text-muted py-4">No reviews yet. Add your first movie above!</td></tr>
    `);
    $('#mainTitle').text('My Movies (0)');
    return;
  }

  const sorted = sortData(currentData);
  let rows = '';

  sorted.forEach(item => {
    if (editingRowId === item.id) {
      rows += `
        <tr id="row-${item.id}" class="editing-row">
          <td><input type="text" class="inline-edit-input" id="edit-name-${item.id}" value="${escapeHtml(item.movie_name || '')}"></td>
          <td>
            <select class="inline-edit-select" id="edit-rating-${item.id}">
              ${[0,1,2,3,4,5].map(n => `<option value="${n}" ${item.rating == n ? 'selected' : ''}>${n}/5</option>`).join('')}
            </select>
          </td>
          <td><input type="text" class="inline-edit-input" id="edit-director-${item.id}" value="${escapeHtml(item.director || '')}" placeholder="Director name" autocomplete="off"></td>
          <td><input type="text" class="inline-edit-input" id="edit-date-${item.id}" value="${toInputDate(item.release_date)}" placeholder="YYYY-MM-DD" maxlength="10" autocomplete="off"></td>
          <td>
            <button class="save-btn" onclick="window.saveEdit('${item.id}')">Save</button>
            <button class="cancel-btn" onclick="window.cancelEdit()">Cancel</button>
          </td>
        </tr>`;
    } else {
      rows += `
        <tr id="row-${item.id}">
          <td><strong>${escapeHtml(item.movie_name || '')}</strong></td>
          <td>${item.rating ?? 0}/5</td>
          <td>${escapeHtml(item.director || '—')}</td>
          <td>${formatDate(item.release_date)}</td>
          <td>
            <button class="edit-btn" onclick="window.editMovie('${item.id}')">Edit</button>
            <button class="delete-btn" onclick="window.deleteMovie('${item.id}')">Delete</button>
          </td>
        </tr>`;
    }
  });

  $('#reviewList').html(rows);
  if (editingRowId) applyDateMask(`#edit-date-${editingRowId}`);
  $('#mainTitle').text(`My Movies (${currentData.length})`);
}

// ── Firestore listener ─────────────────────────────────
const q = query(collection(db, "Movie Reviews"), orderBy("movie_name"));
onSnapshot(q, (snapshot) => {
  currentData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  editingRowId = null;
  renderTable();
});

// ── Add ────────────────────────────────────────────────
window.addMovie = async function() {
  const movieName   = $('#movie_name').val().trim();
  const rating      = parseInt($('#rating').val());
  const director    = $('#director').val().trim();
  const dateRaw     = $('#release_date').val();

  if (!movieName) {
    showFormMessage("Please enter a movie name.", true);
    return;
  }

  try {
    const release_date = dateRaw ? Timestamp.fromDate(new Date(dateRaw)) : null;
    await addDoc(collection(db, "Movie Reviews"), {
      movie_name: movieName,
      rating,
      director: director || "",
      release_date
    });
    $('#movie_name').val('');
    $('#director').val('');
    $('#release_date').val('');
    $('#rating').val('3');
    showFormMessage(`"${movieName}" added successfully!`);
  } catch (err) {
    console.error(err);
    showFormMessage("Failed to add movie. Please try again.", true);
  }
};

function showFormMessage(msg, isError = false) {
  const el = $('#formMessage');
  el.text(msg).removeClass('error');
  if (isError) el.addClass('error');
  setTimeout(() => el.text(''), 3500);
}

// ── Edit / Save / Cancel ───────────────────────────────
window.editMovie = function(id) {
  editingRowId = id;
  renderTable();
};

window.saveEdit = async function(id) {
  const newName     = $(`#edit-name-${id}`).val().trim();
  const newRating   = parseInt($(`#edit-rating-${id}`).val());
  const newDirector = $(`#edit-director-${id}`).val().trim();
  const newDateRaw  = $(`#edit-date-${id}`).val();

  if (!newName) { showToast("Movie name cannot be empty.", true); return; }

  try {
    const release_date = newDateRaw ? Timestamp.fromDate(new Date(newDateRaw)) : null;
    await updateDoc(doc(db, "Movie Reviews", id), {
      movie_name: newName,
      rating: newRating,
      director: newDirector || "",
      release_date
    });
    editingRowId = null;
    showToast(`"${newName}" updated successfully!`);
  } catch (err) {
    console.error(err);
    showToast("Failed to update. Please try again.", true);
  }
};

window.cancelEdit = function() {
  editingRowId = null;
  renderTable();
};

// ── Delete ─────────────────────────────────────────────
window.deleteMovie = function(id) {
  const movie = currentData.find(m => m.id === id);
  const name  = movie ? movie.movie_name : "this movie";
  deleteConfirmId = id;
  $('#deleteConfirmMessage').text(`Delete "${name}"? This action cannot be undone.`);
  $('#deleteConfirmModal').addClass('show');
};

window.confirmDelete = async function() {
  if (!deleteConfirmId) return;
  const id = deleteConfirmId;
  const movie = currentData.find(m => m.id === id);
  const name  = movie ? movie.movie_name : "this movie";
  
  $('#deleteConfirmModal').removeClass('show');
  deleteConfirmId = null;
  
  try {
    await deleteDoc(doc(db, "Movie Reviews", id));
    showToast(`"${name}" deleted.`);
  } catch (err) {
    console.error(err);
    showToast("Failed to delete. Please try again.", true);
  }
};

window.cancelDelete = function() {
  deleteConfirmId = null;
  $('#deleteConfirmModal').removeClass('show');
};

// ── Sort dropdown ──────────────────────────────────────
$('#sortDropdownBtn').on('click', function(e) {
  e.stopPropagation();
  $('#sortDropdownMenu').toggleClass('open');
});

$(document).on('click', function() {
  $('#sortDropdownMenu').removeClass('open');
});

$(document).on('click', '.sort-option', function(e) {
  e.stopPropagation();
  const field = $(this).data('sort');
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = 'asc';
  }
  editingRowId = null;
  $('#sortDropdownMenu').removeClass('open');
  updateSortUI();
  renderTable();
});

// ── Date auto-hyphen ───────────────────────────────────
function applyDateMask(input) {
  $(input).on('input', function() {
    let v = $(this).val().replace(/[^\d]/g, ''); // digits only
    if (v.length > 4) v = v.slice(0,4) + '-' + v.slice(4);
    if (v.length > 7) v = v.slice(0,7) + '-' + v.slice(7);
    $(this).val(v.slice(0, 10));
  });
}

applyDateMask('#release_date');


$('#addButton').on('click', window.addMovie);
$('#movie_name, #director').on('keypress', function(e) {
  if (e.which === 13) window.addMovie();
});

// Init sort UI
updateSortUI();
