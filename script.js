const state = {
    role: null, // 'teacher' | 'student' | null
    user: "",
    view: "dashboard",
    courses: [],
    assignments: [],
    submissions: [],
    students: ["John Student", "Emma Watson", "Alex Chen"], // Predefined global students
    menuOpen: false,
    
    // Draft forms
    cForm: { title: "", code: "", desc: "", materials: [] },
    aForm: { courseId: "", title: "", deadline: "", desc: "", refs: [] },
    editC: null,
};

// --- Persistence & Cleanup ---
const STORAGE_KEY = 'academy_lms_data';

function saveState() {
    // Note: Blob URLs (from file uploads) will NOT work after refresh.
    // In a real app, these would be uploaded to a server.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        courses: state.courses,
        assignments: state.assignments,
        submissions: state.submissions
    }));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const data = JSON.parse(saved);
        state.courses = data.courses || [];
        state.assignments = data.assignments || [];
        state.submissions = data.submissions || [];
        
        cleanupExpiredData();
    }
}

function cleanupExpiredData() {
    const today = new Date().toISOString().split('T')[0];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Remove expired assignments (deadline < today)
    const originalAssignmentsCount = state.assignments.length;
    state.assignments = state.assignments.filter(a => a.deadline >= today);
    
    if (state.assignments.length < originalAssignmentsCount) {
        // Also remove submissions for deleted assignments
        const validIds = state.assignments.map(a => a.id);
        state.submissions = state.submissions.filter(s => validIds.includes(s.assignmentId));
    }

    // Remove courses older than 1 year (assuming id is timestamp from generateId)
    state.courses = state.courses.filter(c => {
        const createdDate = new Date(c.id);
        return createdDate > oneYearAgo;
    });

    saveState();
}


// Accents based on role
const ACCENT = {
    teacher: { btn: "bg-amber-400 text-slate-900", nav: "bg-slate-900 border-slate-700", active: "bg-amber-400/20 text-amber-400", text: "text-amber-400" },
    student: { btn: "bg-blue-500 text-white", nav: "bg-blue-950 border-blue-800", active: "bg-blue-400/20 text-blue-400", text: "text-blue-400" },
};

// DOM Elements
const els = {
    loginView: document.getElementById('loginView'),
    appView: document.getElementById('appView'),
    roleSelection: document.getElementById('roleSelection'),
    teacherLoginForm: document.getElementById('teacherLoginForm'),
    loginUn: document.getElementById('loginUn'),
    loginPw: document.getElementById('loginPw'),
    loginError: document.getElementById('loginError'),
    navUsername: document.getElementById('navUsername'),
    navRoleBadge: document.getElementById('navRoleBadge'),
    navMenu: document.getElementById('navMenu'),
    sidebar: document.getElementById('sidebar'),
    mainContent: document.getElementById('mainContent'),
    mobileMenuOverlay: document.getElementById('mobileMenuOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    editCourseModal: document.getElementById('editCourseModal')
};

// Base Input Class HTML string
const inputBase = "w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-slate-400 text-sm transition-colors";

// --- Helpers ---
function generateId() { return Date.now() + Math.floor(Math.random() * 1000); }

function toast(msg, type = "success") {
    const t = document.createElement('div');
    t.className = `px-6 py-3 rounded-full text-sm font-semibold shadow-xl transition-all duration-300 animate-fade-in ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`;
    t.textContent = msg;
    els.toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

const A = () => ACCENT[state.role];

// --- Authentication ---
document.getElementById('btnTeacherLoginMode').addEventListener('click', () => {
    els.roleSelection.classList.add('hidden');
    els.teacherLoginForm.classList.remove('hidden');
});

document.getElementById('btnLoginBack').addEventListener('click', () => {
    els.teacherLoginForm.classList.add('hidden');
    els.roleSelection.classList.remove('hidden');
    els.loginError.classList.add('hidden');
    els.loginUn.value = ''; els.loginPw.value = '';
});

document.getElementById('btnLoginSubmit').addEventListener('click', attemptLogin);
els.loginPw.addEventListener('keydown', (e) => e.key === 'Enter' && attemptLogin());

function attemptLogin() {
    const un = els.loginUn.value.trim();
    const pw = els.loginPw.value.trim();
    if (un === 'admin' && pw === 'admin') {
        state.role = 'teacher';
        state.user = 'Dr. Johnson';
        loginSuccess();
    } else {
        els.loginError.textContent = "Wrong username or password.";
        els.loginError.classList.remove('hidden');
    }
}

document.getElementById('btnStudentLoginMode').addEventListener('click', () => {
    state.role = 'student';
    state.user = 'John Student';
    loginSuccess();
});

document.getElementById('btnLogout').addEventListener('click', () => {
    state.role = null; state.user = ''; state.view = 'dashboard';
    els.loginUn.value = ''; els.loginPw.value = ''; els.loginError.classList.add('hidden');
    els.teacherLoginForm.classList.add('hidden');
    els.roleSelection.classList.remove('hidden');
    renderShell();
});

function loginSuccess() {
    state.view = 'dashboard';
    toast(`Welcome, ${state.user}!`);
    renderShell();
}

// --- Layout & Navigation ---
document.getElementById('mobileMenuBtn').addEventListener('click', toggleMenu);
els.mobileMenuOverlay.addEventListener('click', toggleMenu);

function toggleMenu() {
    state.menuOpen = !state.menuOpen;
    if (state.menuOpen) {
        els.sidebar.classList.remove('-translate-x-full');
        els.sidebar.classList.add('shadow-2xl');
        els.mobileMenuOverlay.classList.remove('hidden');
    } else {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebar.classList.remove('shadow-2xl');
        els.mobileMenuOverlay.classList.add('hidden');
    }
}

function go(view) {
    state.view = view;
    if (state.menuOpen) toggleMenu();
    updateNavigation();
    renderContent();
}

function renderShell() {
    if (!state.role) {
        els.loginView.classList.remove('hidden');
        els.appView.classList.add('hidden');
        els.appView.classList.remove('flex');
    } else {
        els.loginView.classList.add('hidden');
        els.appView.classList.remove('hidden');
        els.appView.classList.add('flex');
        
        // Setup styling
        els.sidebar.className = `fixed inset-y-0 left-0 z-40 w-64 ${A().nav} border-r transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out md:static md:flex-shrink-0 flex flex-col`;
        els.navUsername.textContent = state.user;
        
        els.navRoleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${state.role === 'teacher' ? 'bg-amber-400' : 'bg-blue-400'}"></span> ${state.role}`;
        els.navRoleBadge.className = `text-xs font-bold mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border ${state.role === 'teacher' ? 'border-amber-500/20 text-amber-400' : 'border-blue-500/20 text-blue-400'} capitalize`;

        updateNavigation();
        renderContent();
    }
}

function updateNavigation() {
    const isTeacher = state.role === 'teacher';
    const links = isTeacher 
        ? [["dashboard","🏠 Home"],["courses","📘 Courses"],["assignments","📝 Assignments"],["submissions","📬 Submissions"]]
        : [["dashboard","🏠 Home"],["courses","📘 Courses"],["assignments","📝 Assignments"],["grades","🏅 Grades"]];

    els.navMenu.innerHTML = links.map(([id, label]) => {
        const isActive = state.view === id;
        const activeClasses = isActive ? `${A().active} tracking-wide border-transparent` : `text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent hover:border-slate-700/50`;
        return `<button onclick="go('${id}')" class="w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center shadow-sm ${activeClasses}">${label}</button>`;
    }).join("");
}

// --- Content Rendering ---
function renderContent() {
    window.scrollTo(0,0);
    els.mainContent.innerHTML = '';
    const isT = state.role === 'teacher';

    if (state.view === "dashboard") {
        const gradedSubmissions = state.submissions.filter(s => s.student === state.user && s.status === 'graded').length;
        const submissionsCount = isT ? state.submissions.length : gradedSubmissions;
        
        els.mainContent.innerHTML = `
            <div class="animate-fade-in">
                <h1 class="text-3xl font-bold text-white mb-1 tracking-tight">Welcome, ${state.user}!</h1>
                <p class="text-slate-500 text-sm mb-6">${isT ? "Manage your LMS platform" : "Your learning portal"}</p>
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div onclick="go('courses')" class="cursor-pointer bg-slate-800/80 border border-slate-700 rounded-2xl p-5 text-center transition-transform hover:-translate-y-1 hover:border-slate-500 shadow-sm">
                        <p class="text-3xl font-bold text-white mb-1">${state.courses.length}</p>
                        <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">Courses</p>
                    </div>
                    <div onclick="go('assignments')" class="cursor-pointer bg-slate-800/80 border border-slate-700 rounded-2xl p-5 text-center transition-transform hover:-translate-y-1 hover:border-slate-500 shadow-sm">
                        <p class="text-3xl font-bold text-white mb-1">${state.assignments.length}</p>
                        <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">Assignments</p>
                    </div>
                    <div onclick="go('${isT ? 'submissions' : 'grades'}')" class="cursor-pointer bg-slate-800/80 border border-slate-700 rounded-2xl p-5 text-center transition-transform hover:-translate-y-1 hover:border-slate-500 shadow-sm">
                        <p class="text-3xl font-bold text-white mb-1">${submissionsCount}</p>
                        <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">${isT ? "Submissions" : "Graded"}</p>
                    </div>
                </div>
                <div class="space-y-3">
                    <button onclick="go('courses')" class="w-full ${A().btn} hover:opacity-90 transition-opacity font-bold py-3.5 rounded-xl text-sm shadow-md">${isT ? "➕ Create Course" : "📘 Browse Enrolled Courses"}</button>
                    <button onclick="go('assignments')" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 rounded-xl text-sm border border-slate-600 transition-colors shadow-sm">${isT ? "➕ Create Assignment" : "📝 View My Assignments"}</button>
                </div>
            </div>
        `;
    } 
    else if (state.view === "courses") {
        renderCoursesView(isT);
    }
    else if (state.view === "assignments") {
        renderAssignmentsView(isT);
    }
    else if (state.view === "submissions" && isT) {
        renderSubmissionsView();
    }
    else if (state.view === "grades" && !isT) {
        renderGradesView();
    }
}

// --- Courses Module ---
function renderCoursesView(isT) {
    let html = `<div class="animate-fade-in"><h1 class="text-2xl font-bold text-white mb-5 tracking-tight">${isT ? "Manage Courses" : "My Courses"}</h1>`;

    if (isT) {
        html += `
            <div class="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-6 space-y-4 shadow-sm">
                <h2 class="text-white font-bold flex items-center gap-2"><span class="bg-amber-400/20 text-amber-400 p-1 rounded-md text-xs">NEW</span> Create Course</h2>
                <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-2"><input id="courseTitle" class="${inputBase}" placeholder="Course Title *" value="${state.cForm.title}"></div>
                    <div class="col-span-1">
                        <select id="courseCode" class="${inputBase} appearance-none cursor-pointer">
                            <option value="" disabled ${!state.cForm.code ? 'selected' : ''}>Code *</option>
                            <option value="AI" ${state.cForm.code === 'AI' ? 'selected' : ''}>AI</option>
                            <option value="DMW" ${state.cForm.code === 'DMW' ? 'selected' : ''}>DMW</option>
                            <option value="MAD" ${state.cForm.code === 'MAD' ? 'selected' : ''}>MAD</option>
                            <option value="WCD" ${state.cForm.code === 'WCD' ? 'selected' : ''}>WCD</option>
                            <option value="Other" ${state.cForm.code === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
                <textarea id="courseDesc" class="${inputBase} h-20 resize-none" placeholder="Brief description (optional)">${state.cForm.desc}</textarea>
                <div>
                    <p class="text-slate-400 text-xs mb-1 font-semibold">Study Materials (Links/Notes)</p>
                    <div class="flex gap-2">
                    <label class="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-400 px-4 flex items-center justify-center rounded-xl cursor-pointer transition-colors shadow-sm" title="Upload File (PDF/Photo)">
                        <span class="text-lg">📎</span>
                        <input type="file" class="hidden" accept=".pdf,image/*" onchange="handleFileUpload(event, 'course')">
                    </label>
                    <input id="courseMaterial" class="${inputBase} flex-1" placeholder="Paste URL or type note…">
                    <button onclick="addCourseMaterial()" class="bg-slate-700 hover:bg-slate-600 text-white px-5 rounded-xl text-sm font-semibold transition-colors">Add</button>
                </div>
                </div>
                <div id="cFormMaterials" class="space-y-2 pt-2">
                    ${state.cForm.materials.map(m => `
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2.5 gap-2">
                            <span class="text-slate-300 text-sm truncate flex items-center gap-2"><span class="text-amber-400">🔗</span> ${m.text}</span>
                            <div class="flex items-center gap-2">
                                ${m.url ? `
                                    <a href="${m.url}" target="_blank" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors">Open</a>
                                    <a href="${m.url}" download="${m.download}" class="text-xs bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 px-2 py-1 rounded transition-colors">Download</a>
                                ` : ''}
                                <button onclick="removeCourseMaterial(${m.id})" class="text-red-400 hover:text-red-300 text-xs p-1 font-bold ml-1">✕</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="createCourse()" class="w-full bg-amber-400 hover:bg-amber-300 transition-colors text-slate-900 font-bold py-3.5 rounded-xl text-sm shadow-md mt-2">Publish Course</button>
            </div>
        `;
    }

    html += `<div class="space-y-4">`;
    if (state.courses.length === 0) {
        html += `
            <div class="text-center py-12 border border-slate-800 rounded-2xl border-dashed">
                <div class="text-3xl mb-2">🏜️</div>
                <p class="text-slate-500 font-medium">No courses available yet.</p>
            </div>`;
    }

    state.courses.forEach(c => {
        let materialsHtml = '';
        if (c.materials && c.materials.length > 0) {
            materialsHtml = `
                <div class="space-y-2 mb-3">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Materials</p>
                    ${c.materials.map(m => {
                        const isLink = m.text.startsWith('http');
                        return `
                        <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors hover:bg-slate-800">
                            <div class="flex items-center gap-2 truncate">
                                ${isLink ? `<span class="text-blue-400 text-xs">🔗</span>` : `<span class="text-slate-500 text-xs">📝</span>`}
                                <span class="text-slate-300 text-sm truncate">${m.text}</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                ${m.url ? `
                                    <a href="${m.url}" target="_blank" class="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">Open</a>
                                    <a href="${m.url}" download="${m.download}" class="text-[10px] uppercase font-bold text-amber-400 hover:text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">Download</a>
                                ` : (isLink ? `<a href="${m.text}" target="_blank" class="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">Visit Link</a>` : '')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
        }

        let teacherControls = isT ? `
            <div class="flex gap-2 pt-4 border-t border-slate-800/50 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="openEditCourse(${c.id})" class="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"><span class="text-amber-400">✏️</span> Edit</button>
                <button onclick="deleteCourse(${c.id})" class="text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">🗑 Delete</button>
            </div>
        ` : '';

        html += `
            <div class="bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors rounded-2xl p-6 shadow-sm group">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-white font-bold text-lg">${c.title}</h3>
                    <span class="text-xs px-2.5 py-1 rounded-lg ml-3 flex-shrink-0 font-bold ${isT ? 'bg-amber-400/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}">${c.code}</span>
                </div>
                ${c.desc ? `<p class="text-slate-400 text-sm mb-4 leading-relaxed">${c.desc}</p>` : ''}
                ${materialsHtml}
                ${teacherControls}
            </div>
        `;
    });

    html += `</div></div>`;
    els.mainContent.innerHTML = html;

    // Attach listeners for persistence during typing
    if (isT) {
        document.getElementById('courseTitle').addEventListener('input', e => state.cForm.title = e.target.value);
        document.getElementById('courseCode').addEventListener('change', e => state.cForm.code = e.target.value);
        document.getElementById('courseDesc').addEventListener('input', e => state.cForm.desc = e.target.value);
        const cm = document.getElementById('courseMaterial');
        cm.addEventListener('keydown', e => { if(e.key === 'Enter') addCourseMaterial(); });
    }
}

window.addCourseMaterial = function() {
    const input = document.getElementById('courseMaterial');
    const val = input.value.trim();
    if (!val) return;
    state.cForm.materials.push({ id: generateId(), text: val });
    input.value = '';
    renderContent();
};
window.removeCourseMaterial = function(id) {
    state.cForm.materials = state.cForm.materials.filter(m => m.id !== id);
    renderContent();
};
window.createCourse = function() {
    if (!state.cForm.title.trim()) return toast("Enter a course title.", "error");
    if (!state.cForm.code.trim()) return toast("Enter a course code.", "error");
    
    state.courses.push({
        id: generateId(),
        title: state.cForm.title,
        code: state.cForm.code,
        desc: state.cForm.desc,
        materials: [...state.cForm.materials]
    });
    
    state.cForm = { title: "", code: "", desc: "", materials: [] };
    saveState();
    toast("Course created!");
    renderContent();
};
window.deleteCourse = function(id) {
    state.courses = state.courses.filter(c => c.id !== id);
    saveState();
    toast("Course deleted.", "error");
    renderContent();
};
window.openEditCourse = function(id) {
    state.editC = { ...state.courses.find(c => c.id === id) };
    document.getElementById('editCourseTitle').value = state.editC.title;
    document.getElementById('editCourseCode').value = state.editC.code;
    document.getElementById('editCourseDesc').value = state.editC.desc;
    els.editCourseModal.classList.remove('hidden');
};

document.getElementById('btnCloseEditModal').addEventListener('click', () => els.editCourseModal.classList.add('hidden'));
document.getElementById('btnCancelEditCourse').addEventListener('click', () => els.editCourseModal.classList.add('hidden'));
document.getElementById('btnSaveEditCourse').addEventListener('click', () => {
    state.editC.title = document.getElementById('editCourseTitle').value;
    state.editC.code = document.getElementById('editCourseCode').value;
    state.editC.desc = document.getElementById('editCourseDesc').value;

    if (!state.editC.title.trim() || !state.editC.code.trim()) return toast("Title and code required.", "error");

    const index = state.courses.findIndex(c => c.id === state.editC.id);
    if(index !== -1) Object.assign(state.courses[index], state.editC);
    
    saveState();
    els.editCourseModal.classList.add('hidden');
    toast("Course updated!");
    renderContent();
});


// --- Assignments Module ---
function renderAssignmentsView(isT) {
    let html = `<div class="animate-fade-in"><h1 class="text-2xl font-bold text-white mb-5 tracking-tight">${isT ? "Manage Assignments" : "My Assignments"}</h1>`;

    if (isT) {
        html += `
        <div class="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-6 space-y-4 shadow-sm">
            <h2 class="text-white font-bold flex items-center gap-2"><span class="bg-amber-400/20 text-amber-400 p-1 rounded-md text-xs">NEW</span> Create Assignment</h2>
            <div class="grid grid-cols-2 gap-3">
                <select id="aFormCourseId" class="${inputBase} appearance-none cursor-pointer">
                    <option value="" disabled ${!state.aForm.courseId ? 'selected' : ''}>Select Target Course *</option>
                    <option value="AI" ${state.aForm.courseId === 'AI' ? 'selected' : ''}>AI</option>
                    <option value="DMW" ${state.aForm.courseId === 'DMW' ? 'selected' : ''}>DMW</option>
                    <option value="MAD" ${state.aForm.courseId === 'MAD' ? 'selected' : ''}>MAD</option>
                    <option value="WCD" ${state.aForm.courseId === 'WCD' ? 'selected' : ''}>WCD</option>
                    <option value="Other" ${state.aForm.courseId === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <div class="relative">
                    <input id="aFormDeadline" class="${inputBase}" type="date" value="${state.aForm.deadline}">
                    ${!state.aForm.deadline ? `<span class="absolute top-1/2 left-4 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">Deadline *</span>` : ''}
                </div>
            </div>
            <input id="aFormTitle" class="${inputBase}" placeholder="Assignment Title *" value="${state.aForm.title}">
            <textarea id="aFormDesc" class="${inputBase} h-24 resize-none" placeholder="Detailed instructions (optional)">${state.aForm.desc}</textarea>
            <div>
                <p class="text-slate-400 text-xs mb-1 font-semibold">Reference Materials (Links/Notes)</p>
                <div class="flex gap-2">
                <label class="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-400 px-4 flex items-center justify-center rounded-xl cursor-pointer transition-colors shadow-sm" title="Upload File (PDF/Photo)">
                    <span class="text-lg">📎</span>
                    <input type="file" class="hidden" accept=".pdf,image/*" onchange="handleFileUpload(event, 'assignment')">
                </label>
                <input id="aFormRef" class="${inputBase} flex-1" placeholder="Paste URL or type note…">
                <button onclick="addAssignmentRef()" class="bg-slate-700 hover:bg-slate-600 text-white px-5 rounded-xl text-sm font-semibold transition-colors">Add</button>
            </div>
            </div>
            <div class="space-y-2 pt-2">
                ${state.aForm.refs.map(r => `
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2.5 gap-2">
                        <span class="text-slate-300 text-sm truncate flex items-center gap-2"><span class="text-amber-400">🔗</span> ${r.text}</span>
                        <div class="flex items-center gap-2">
                            ${r.url ? `
                                <a href="${r.url}" target="_blank" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors">Open</a>
                                <a href="${r.url}" download="${r.download}" class="text-xs bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 px-2 py-1 rounded transition-colors">Download</a>
                            ` : ''}
                            <button onclick="removeAssignmentRef(${r.id})" class="text-red-400 hover:text-red-300 text-xs p-1 font-bold ml-1">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="createAssignment()" class="w-full bg-amber-400 hover:bg-amber-300 transition-colors text-slate-900 font-bold py-3.5 rounded-xl text-sm shadow-md mt-2">Publish Assignment</button>
        </div>
        `;
    }

    html += `<div class="space-y-4">`;
    if (state.assignments.length === 0) {
        html += `
            <div class="text-center py-12 border border-slate-800 rounded-2xl border-dashed">
                <div class="text-3xl mb-2">📭</div>
                <p class="text-slate-500 font-medium">No assignments yet.</p>
            </div>`;
    }

    state.assignments.forEach(a => {
        const courseCode = a.courseId;
        const mySub = state.submissions.find(s => s.assignmentId === a.id && s.student === state.user);
        
        let refsHtml = '';
        if(a.refs && a.refs.length > 0) {
            refsHtml = `
            <div class="mb-4">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">References</p>
                ${a.refs.map(r => {
                    const isLink = r.text.startsWith('http');
                    return `
                    <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 mb-1.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors hover:bg-slate-800">
                        <div class="flex items-center gap-2 truncate">
                            ${isLink ? `<span class="text-blue-400 text-xs">🔗</span>` : `<span class="text-slate-500 text-xs">📝</span>`}
                            <span class="text-slate-300 text-sm truncate">${r.text}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${r.url ? `
                                <a href="${r.url}" target="_blank" class="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">Open</a>
                                <a href="${r.url}" download="${r.download}" class="text-[10px] uppercase font-bold text-amber-400 hover:text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">Download</a>
                            ` : (isLink ? `<a href="${r.text}" target="_blank" class="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">Visit Link</a>` : '')}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        }

        let submissionUI = '';
        const isNotTurnedIn = (!mySub || mySub.status === 'unsubmitted');
        
        if (!isT && isNotTurnedIn) {
            submissionUI = `
                <div class="mt-5 pt-5 border-t border-slate-800/50 space-y-3 bg-slate-900/30 rounded-xl">
                    <div class="flex justify-between items-center">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Answer</p>
                        <label class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg cursor-pointer transition-colors border border-slate-700 flex items-center gap-1.5 shadow-sm">
                            <span>📎</span> Upload File
                            <input type="file" class="hidden" accept=".pdf,image/*" onchange="handleStudentUpload(event, ${a.id})">
                        </label>
                    </div>
                    <textarea id="subText_${a.id}" class="${inputBase} h-28 resize-none shadow-inner" placeholder="Write your submission here, or upload a file above..."></textarea>
                    <div id="attachments_${a.id}" class="space-y-2">
                        ${(mySub && mySub.attachments ? mySub.attachments : []).map(att => `
                            <div id="att_${att.id}" class="flex items-center gap-2 mt-2 bg-slate-800 p-2 rounded-lg text-sm border border-slate-700">
                                <a href="${att.url}" target="_blank" download="${att.download}" class="text-blue-400 hover:text-blue-300 underline flex-1 truncate">${att.text}</a>
                                <button onclick="removeStudentAttachment(${a.id}, ${att.id})" class="text-red-400 hover:text-red-300 font-bold px-2">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button onclick="submitAssignment(${a.id})" class="w-full bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-3.5 rounded-xl text-sm shadow-md">Turn in Assignment</button>
                </div>
            `;
        } else if (!isT && mySub && mySub.fb) {
            submissionUI = `
                <div class="mt-4 pt-4 border-t border-slate-800/50">
                    <div class="bg-slate-800/80 border border-slate-700 rounded-xl p-4 relative">
                        <span class="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-semibold text-slate-400">Teacher Feedback</span>
                        <p class="text-slate-300 text-sm leading-relaxed">${mySub.fb}</p>
                    </div>
                </div>
            `;
        } else if (isT) {
            const turnedInCount = state.submissions.filter(s => s.assignmentId === a.id && s.status !== 'unsubmitted').length;
            submissionUI = `
                <div class="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center">
                    <p class="text-slate-400 text-xs font-medium bg-slate-800 px-3 py-1.5 rounded-full"><span class="text-amber-400 font-bold">${turnedInCount}</span> out of ${state.students.length} turned in</p>
                </div>
            `;
        }

        html += `
            <div class="bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors rounded-2xl p-6 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-white font-bold text-lg">${a.title}</h3>
                    ${!isNotTurnedIn ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-lg ml-3 flex-shrink-0 ${mySub.status === 'graded' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}">${mySub.status === 'graded' ? `${mySub.marks}% Score` : 'Submitted'}</span>` : ''}
                </div>
                <div class="flex items-center gap-3 mb-4">
                    <span class="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-slate-300">${courseCode || '?'}</span>
                    <p class="text-slate-400 text-xs flex items-center gap-1.5"><span class="text-slate-500">📅</span> Due ${a.deadline}</p>
                </div>
                ${a.desc ? `<p class="text-slate-300 text-sm mb-4 leading-relaxed bg-slate-800/30 p-3 rounded-xl">${a.desc}</p>` : ''}
                ${refsHtml}
                ${submissionUI}
            </div>
        `;
    });

    html += `</div></div>`;
    els.mainContent.innerHTML = html;

    // Listeners for Draft
    if (isT) {
        document.getElementById('aFormCourseId').addEventListener('change', e => state.aForm.courseId = e.target.value);
        document.getElementById('aFormTitle').addEventListener('input', e => state.aForm.title = e.target.value);
        document.getElementById('aFormDeadline').addEventListener('change', e => { state.aForm.deadline = e.target.value; renderContent(); });
        document.getElementById('aFormDesc').addEventListener('input', e => state.aForm.desc = e.target.value);
        document.getElementById('aFormRef').addEventListener('keydown', e => { if(e.key === 'Enter') addAssignmentRef(); });
    }
}

window.handleFileUpload = function(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    let icon = '📎';
    if (isImage) icon = '🖼️';
    else if (isPdf) icon = '📄';
    
    const text = `${icon} ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const fileUrl = URL.createObjectURL(file);
    const downloadName = file.name;
    
    if (type === 'course') {
        state.cForm.materials.push({ id: generateId(), text: text, url: fileUrl, download: downloadName });
    } else {
        state.aForm.refs.push({ id: generateId(), text: text, url: fileUrl, download: downloadName });
    }
    toast("File attached!");
    renderContent();
};

window.handleStudentUpload = function(e, aid) {
    const file = e.target.files[0];
    if (!file) return;

    let sub = state.submissions.find(s => s.assignmentId === aid && s.student === state.user);
    if (!sub) {
        sub = { id: generateId(), assignmentId: aid, student: state.user, text: "", date: "-", status: "unsubmitted", marks: null, fb: "", attachments: [] };
        state.submissions.push(sub);
    }
    if (!sub.attachments) sub.attachments = [];

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    let icon = '📎';
    if (isImage) icon = '🖼️';
    else if (isPdf) icon = '📄';
    
    const fileUrl = URL.createObjectURL(file);
    const attachment = { id: generateId(), text: `${icon} ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`, url: fileUrl, download: file.name };
    sub.attachments.push(attachment);

    toast("File attached to submission.");
    
    const container = document.getElementById(`attachments_${aid}`);
    if (container) {
        container.innerHTML += `
            <div id="att_${attachment.id}" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 bg-slate-800 p-2 rounded-lg text-sm border border-slate-700">
                <span class="text-slate-300 flex-1 truncate px-1">${attachment.text}</span>
                <div class="flex items-center gap-2">
                    <a href="${attachment.url}" target="_blank" class="text-[10px] uppercase font-bold bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Open</a>
                    <a href="${attachment.url}" download="${attachment.download}" class="text-[10px] uppercase font-bold bg-blue-500 hover:bg-blue-400 text-white px-2 py-1 rounded">Download</a>
                    <button onclick="removeStudentAttachment(${aid}, ${attachment.id})" class="text-red-400 hover:text-red-300 font-bold px-2">✕</button>
                </div>
            </div>
        `;
    }
};

window.removeStudentAttachment = function(aid, attId) {
    let sub = state.submissions.find(s => s.assignmentId === aid && s.student === state.user);
    if (sub && sub.attachments) {
        sub.attachments = sub.attachments.filter(a => a.id !== attId);
        const el = document.getElementById(`att_${attId}`);
        if(el) el.remove();
    }
};

window.addAssignmentRef = function() {
    const input = document.getElementById('aFormRef');
    if (!input.value.trim()) return;
    state.aForm.refs.push({ id: generateId(), text: input.value.trim() });
    input.value = '';
    renderContent();
};
window.removeAssignmentRef = function(id) {
    state.aForm.refs = state.aForm.refs.filter(r => r.id !== id);
    renderContent();
};
window.createAssignment = function() {
    if (!state.aForm.courseId) return toast("Select a course.", "error");
    if (!state.aForm.title.trim()) return toast("Enter a title.", "error");
    if (!state.aForm.deadline) return toast("Set a deadline.", "error");
    
    const aid = generateId();
    state.assignments.push({
        id: aid,
        courseId: state.aForm.courseId,
        title: state.aForm.title,
        deadline: state.aForm.deadline,
        desc: state.aForm.desc,
        refs: [...state.aForm.refs]
    });
    
    // Distribute assignment directly to all students marking as unsubmitted
    state.students.forEach(sName => {
        state.submissions.push({
            id: generateId(),
            assignmentId: aid,
            student: sName,
            text: "",
            date: "-",
            status: "unsubmitted",
            marks: null,
            fb: "",
            attachments: []
        });
    });
 
    state.aForm = { courseId: "", title: "", deadline: "", desc: "", refs: [] };
    saveState();
    toast("Assignment dispatched to students!");
    renderContent();
};

window.submitAssignment = function(aid) {
    const txt = document.getElementById(`subText_${aid}`).value.trim();
    const sub = state.submissions.find(s => s.assignmentId === aid && s.student === state.user);
    const hasAttachments = sub && sub.attachments && sub.attachments.length > 0;
    
    if (!txt && !hasAttachments) return toast("Write your answer or attach a file first.", "error");

    if(sub) {
        sub.text = txt;
        sub.date = new Date().toLocaleDateString();
        sub.status = "pending";
    } else {
        state.submissions.push({
            id: generateId(), assignmentId: aid, student: state.user, text: txt, date: new Date().toLocaleDateString(), status: "pending", marks: null, fb: "", attachments: []
        });
    }
    saveState();
    toast("Turned In Successfully!");
    renderContent();
};

// --- Submissions View (Teacher) ---
function renderSubmissionsView() {
    const studentsArr = state.students;
    
    let html = `
    <div class="animate-fade-in">
        <h1 class="text-2xl font-bold text-white mb-5 tracking-tight">Student Submissions</h1>
        <div class="grid grid-cols-4 gap-3 mb-8">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center shadow-sm">
                <p class="text-2xl font-bold text-white mb-1">${studentsArr.length}</p>
                <p class="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Students</p>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center shadow-sm">
                <p class="text-2xl font-bold text-slate-400 mb-1">${state.submissions.filter(s => s.status === 'unsubmitted').length}</p>
                <p class="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Unsubmitted</p>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center shadow-sm border-l-4 border-l-yellow-400 mt-2 sm:mt-0">
                <p class="text-2xl font-bold text-yellow-400 mb-1">${state.submissions.filter(s => s.status === 'pending').length}</p>
                <p class="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Needs Grading</p>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center shadow-sm border-l-4 border-l-green-400 mt-2 sm:mt-0">
                <p class="text-2xl font-bold text-green-400 mb-1">${state.submissions.filter(s => s.status === 'graded').length}</p>
                <p class="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Graded</p>
            </div>
        </div>
    `;

    const activeSubmissions = state.submissions.filter(s => s.status !== 'unsubmitted');
    
    if (activeSubmissions.length === 0) {
        html += `
        <div class="text-center py-12 border border-slate-800 rounded-2xl border-dashed">
            <div class="text-3xl mb-2">🛌</div>
            <p class="text-slate-500 font-medium">No turned-in submissions to review yet.</p>
        </div>`;
    }

    html += `<div class="space-y-4">`;
    activeSubmissions.forEach(s => {
        const a = state.assignments.find(x => x.id === s.assignmentId);
        const courseCode = a?.courseId;
        
        let gradingUi = '';
        if (s.status === 'pending') {
            gradingUi = `
            <div class="space-y-3 mt-4 pt-4 border-t border-slate-800/50">
                <div class="flex flex-col sm:flex-row gap-3">
                    <div class="w-full sm:w-32 relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                        <input id="score_${s.id}" class="${inputBase} pl-8 font-bold text-amber-400" placeholder="Score" type="number" min="0" max="100">
                    </div>
                    <input id="fb_${s.id}" class="${inputBase} flex-1" placeholder="Write constructive feedback for the student...">
                </div>
                <button onclick="saveGrade(${s.id})" class="w-full bg-amber-400 hover:bg-amber-300 transition-colors text-slate-900 font-bold py-3 rounded-xl text-sm shadow-md">Publish Grade & Feedback</button>
            </div>`;
        } else {
            gradingUi = `
            <div class="mt-4 pt-4 border-t border-slate-800/50">
                <p class="text-slate-400 text-sm bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <span class="text-amber-400 mr-2">💬 Your Feedback:</span> ${s.fb || '<span class="italic text-slate-500">No feedback provided</span>'}
                </p>
            </div>`;
        }

        html += `
        <div class="bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors rounded-2xl p-6 shadow-sm group">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="text-white font-bold text-lg">${s.student}</h3>
                        <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${s.status === 'graded' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}">
                            ${s.status === 'graded' ? `${s.marks}% Scored` : 'Pending Grade'}
                        </span>
                    </div>
                    <p class="text-slate-400 text-xs font-medium">
                        <span class="text-amber-400">${courseCode}</span> • ${a?.title} • Submitted ${s.date}
                    </p>
                </div>
            </div>
            
            <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-4 relative shadow-inner">
                <span class="absolute -top-2.5 left-4 bg-slate-900 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submission Payload</span>
                ${s.text ? `<p class="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-mono pb-2">${s.text}</p>` : ''}
                ${s.attachments && s.attachments.length > 0 ? `
                    <div class="space-y-2 mt-2 pt-2 border-t border-slate-800/50">
                        <p class="text-slate-500 text-xs font-semibold uppercase">Attachments</p>
                        ${s.attachments.map(att => `
                            <div class="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-3 group/att transition-all hover:border-slate-500">
                                <span class="text-slate-300 text-sm truncate pr-4">${att.text}</span>
                                <div class="flex items-center gap-2 shrink-0">
                                    <a href="${att.url}" target="_blank" class="text-[10px] uppercase font-bold text-blue-400 border border-blue-400/30 px-3 py-1 rounded hover:bg-blue-400/10 transition-colors">Open</a>
                                    <a href="${att.url}" download="${att.download}" class="text-[10px] uppercase font-bold text-amber-400 border border-amber-400/30 px-3 py-1 rounded hover:bg-amber-400/10 transition-colors">Download</a>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            ${gradingUi}
        </div>`;
    });

    html += `</div></div>`;
    els.mainContent.innerHTML = html;
}

window.saveGrade = function(subId) {
    const marks = document.getElementById(`score_${subId}`).value;
    const fb = document.getElementById(`fb_${subId}`).value;
    if (!marks) return toast("Enter a score.", "error");

    const sub = state.submissions.find(s => s.id === subId);
    if(sub) {
        sub.marks = marks;
        sub.fb = fb;
        sub.status = "graded";
    }
    saveState();
    toast("Graded!");
    renderContent();
};


// --- Grades View (Student) ---
function renderGradesView() {
    const mySubs = state.submissions.filter(s => s.student === state.user && s.status === "graded");
    
    let html = `
    <div class="animate-fade-in">
        <h1 class="text-2xl font-bold text-white mb-5 tracking-tight">My Gradebook</h1>
    `;

    if (mySubs.length === 0) {
        html += `
        <div class="text-center py-12 border border-slate-800 rounded-2xl border-dashed">
            <div class="text-3xl mb-2">🎓</div>
            <p class="text-slate-500 font-medium">No grades have been published yet.</p>
        </div>`;
    }

    html += `<div class="space-y-4">`;
    mySubs.forEach(s => {
        const a = state.assignments.find(x => x.id === s.assignmentId);
        const courseCode = a?.courseId;
        const isExcellent = Number(s.marks) >= 90;
        
        html += `
        <div class="bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm group">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1.5">
                    <h3 class="text-white font-bold text-lg">${a?.title}</h3>
                    <span class="bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-blue-500/20">${courseCode}</span>
                </div>
                <p class="text-slate-500 text-xs font-medium mb-3">Submitted on ${s.date}</p>
                ${s.fb ? `
                <div class="bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl relative">
                    <span class="absolute -top-2 left-3 bg-slate-900 px-1 text-[10px] text-slate-400 font-bold tracking-wider">TEACHER NOTES</span>
                    <p class="text-slate-300 text-sm leading-relaxed">${s.fb}</p>
                </div>` : ''}
            </div>
            <div class="text-right flex flex-col items-center justify-center p-4 rounded-2xl ${isExcellent ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20' : 'bg-slate-800/50 border border-slate-700/50'} min-w-[100px]">
                <p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">SCORE</p>
                <span class="text-4xl font-black ${isExcellent ? 'text-green-400' : 'text-blue-400'}">${s.marks}</span>
            </div>
        </div>`;
    });

    html += `</div></div>`;
    els.mainContent.innerHTML = html;
}

// Initial Call
loadState();
renderShell();
