// set the actual course links so we can get the data
const COURSES = [
    { url: 'https://bev.facey.rocks/cs10.html', name: 'CS 10' },
    { url: 'https://bev.facey.rocks/cs20.html', name: 'CS 20' },
    { url: 'https://bev.facey.rocks/cs30.html', name: 'CS 30' }
];

// save data to cookies so we dont need a backend (can be hosted on github pages now :)  )
const COOKIE_NAME = 'assignment_progress';
const END_DATE = new Date('2026-01-20T23:59:59');

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const data = parts.pop().split(';').shift();
        try {
            return JSON.parse(decodeURIComponent(data));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};${expires};path=/`;
}


// gets data from the course page (based on the url)
async function fetchAssignments(url) {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a[href]');
    
    const assignments = [];
    links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        // Ignore the home page link and GitHub edit links
        if (href && text && 
            href !== 'https://bev.facey.rocks/' && 
            !href.includes('github.com')) {
            assignments.push({
                href: href,
                name: text
            });
        }
    });
    
    return assignments;
}

// update cookie and re-render assignments when an assignment is toggled
function toggleAssignment(courseUrl, assignmentHref) {
    const progress = getCookie(COOKIE_NAME);
    if (!progress[courseUrl]) {
        progress[courseUrl] = [];
    }
    
    const index = progress[courseUrl].indexOf(assignmentHref);
    if (index > -1) {
        progress[courseUrl].splice(index, 1);
    } else {
        progress[courseUrl].push(assignmentHref);
    }
    
    setCookie(COOKIE_NAME, progress);
    renderAssignments();
}

function isCompleted(courseUrl, assignmentHref) {
    const progress = getCookie(COOKIE_NAME);
    return progress[courseUrl] && progress[courseUrl].includes(assignmentHref);
}

let allAssignments = {};

// load assignments from all courses
async function loadAssignments() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">Loading assignments...</div>';
    
    try {
        allAssignments = {};
        
        for (const course of COURSES) {
            try {
                const assignments = await fetchAssignments(course.url);
                allAssignments[course.url] = {
                    name: course.name,
                    assignments: assignments
                };
            } catch (err) {
                console.error(`Error loading ${course.name}:`, err);
                allAssignments[course.url] = {
                    name: course.name,
                    assignments: [],
                    error: true
                };
            }
        }
        
        renderAssignments();
    } catch (err) {
        content.innerHTML = `<div class="error">Error loading assignments: ${err.message}</div>`;
    }
}

// renders / updates assignments and progress bars we just loaded (main function-ish)
// basically the big data handler that loads all the elements based on what we got from loadAssignments
function renderAssignments() {
    const content = document.getElementById('content');
    const progress = getCookie(COOKIE_NAME);
    
    let totalAssignments = 0;
    let totalCompleted = 0;
    
    Object.values(allAssignments).forEach(course => {
        totalAssignments += course.assignments.length;
    });
    
    Object.values(progress).forEach(completed => {
        totalCompleted += completed.length;
    });
    
    const overallPercent = totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0;
    
    let html = `
        <div class="overall-stats">
            <h2>Overall Progress</h2>
            <p>${totalCompleted} of ${totalAssignments} completed (${overallPercent}%)</p>
        </div>
        <div class="countdown-section" style="background: none; color: #333; padding: 10px; margin-bottom: 20px; box-shadow: none;">
            <h3 style="font-size: 1em; font-weight: normal; margin-bottom: 5px;">Time Until Last Day of Class</h3>
            <div id="countdown" class="countdown" style="font-size: 1.2em; font-weight: normal; color: #333;"></div>
        </div>
    `;
    
    // render each course section and its assignments (with progress bars)
    for (const [url, course] of Object.entries(allAssignments)) {
        if (course.error) {
            html += `
                <div class="course-section">
                    <div class="course-header">
                        <h2 class="course-title">${course.name}</h2>
                    </div>
                    <div class="error">Could not load assignments from this course</div>
                </div>
            `;
            continue;
        }
        
        const completed = progress[url] ? progress[url].length : 0;
        const total = course.assignments.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        html += `
            <div class="course-section">
                <div class="course-header">
                    <h2 class="course-title">${course.name}</h2>
                    <span class="course-stats">${completed}/${total} completed</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%">${percent}%</div>
                </div>
                <div class="assignments-grid">
        `;
        
        course.assignments.forEach(assignment => {
            const checked = isCompleted(url, assignment.href);
            html += `
                <div class="assignment-item ${checked ? 'completed' : ''}" onclick="toggleAssignment('${url}', '${assignment.href}')">
                    <input type="checkbox" class="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation()">
                    <span class="assignment-name">${assignment.name}</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

// kinda useless but whatever
function clearProgress() {
    if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
        setCookie(COOKIE_NAME, {});
        renderAssignments();
    }
}


// constantly update the countdown timer to the last day of class (motivation)
function updateCountdown() {
    const element = document.getElementById('countdown');
    if (!element) return;

    const now = new Date();
    const diff = END_DATE - now;
    
    if (diff <= 0) {
        element.textContent = 'Class has ended!';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    element.textContent = 
        `${days}d ${hours}h ${minutes}m ${seconds}s`;
}




// Dark Mode Toggle (because my eyes hurt at night)
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    if (e.target.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

toggleSwitch.addEventListener('change', switchTheme, false);

// Initialize and start it up
loadAssignments();

// keep the countdown updated every second
updateCountdown();
setInterval(updateCountdown, 1000);