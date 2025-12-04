// set the actual course links so we can get the data
const COURSE_TYPES = {
    cs: {
        name: 'Computing Science',
        courses: [
            { url: 'https://bev.facey.rocks/cs10.html', name: 'CS 10' },
            { url: 'https://bev.facey.rocks/cs20.html', name: 'CS 20' },
            { url: 'https://bev.facey.rocks/cs30.html', name: 'CS 30' }
        ]
    },
    robotics: {
        name: 'Robotics',
        courses: [
            { url: 'https://bev.facey.rocks/r10.html', name: 'R 10' },
            { url: 'https://bev.facey.rocks/r20.html', name: 'R 20' },
            { url: 'https://bev.facey.rocks/r30.html', name: 'R 30' }
        ]
    },
    it: {
        name: 'Information Technology',
        courses: [
            { url: 'https://bev.facey.rocks/it10.html', name: 'IT 10' },
            { url: 'https://bev.facey.rocks/it20.html', name: 'IT 20' },
            { url: 'https://bev.facey.rocks/it30.html', name: 'IT 30' }
        ]
    },
    dmd: {
        name: 'Digital Media and Design',
        courses: [
            { url: 'https://bev.facey.rocks/DMD10.html', name: 'DMD 10' },
            { url: 'https://bev.facey.rocks/DMD20.html', name: 'DMD 20' },
            { url: 'https://bev.facey.rocks/DMD30.html', name: 'DMD 30' }
        ]
    }
};

// save data to cookies so we dont need a backend (can be hosted on github pages now :)  )
let currentCourseType = 'cs'; // default to Computing Science
let COURSES = COURSE_TYPES[currentCourseType].courses;
const COOKIE_NAME_PREFIX = 'assignment_progress_';
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

function getCurrentCookieName() {
    return COOKIE_NAME_PREFIX + currentCourseType;
}

function switchCourseType(type) {
    if (COURSE_TYPES[type]) {
        currentCourseType = type;
        COURSES = COURSE_TYPES[currentCourseType].courses;
        setCookie('selected_course_type', type);
        loadAssignments();
        updateCourseTypeDisplay();
    }
}

function updateCourseTypeDisplay() {
    const buttons = document.querySelectorAll('.course-type-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === currentCourseType) {
            btn.classList.add('active');
        }
    });
    
    // Update the subtitle
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.textContent = `Track your ${COURSE_TYPES[currentCourseType].name} assignments`;
    }
}


// gets data from the course page (based on the url)
async function fetchAssignments(url, globalSeenHrefs) {
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
            !href.includes('github.com') &&
            !href.includes('netacad.com') &&
             !href.includes('moodlehub.ca') &&
            !globalSeenHrefs.has(href)) { // Check if we've already seen this link globally
            
            globalSeenHrefs.add(href); // Add to global seen set
            assignments.push({
                href: href,
                name: text
            });
        }
    });
    
    // Special handling for IT pages - look for NET course codes that aren't already linked
    if (url.includes('/it')) {
        // Get all linked NET courses to avoid duplicates
        const linkedNetCourses = new Set();
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            
            // Check for NET courses in both href and link text
            if (href && (href.includes('NET') || href.match(/\/NET\d+\.html/))) {
                const netMatch = href.match(/NET\d+/);
                if (netMatch) {
                    linkedNetCourses.add(netMatch[0]);
                }
            }
            // Also check if the link text itself is a NET course
            if (text && text.match(/NET\d+/)) {
                const netMatch = text.match(/NET\d+/);
                if (netMatch) {
                    linkedNetCourses.add(netMatch[0]);
                }
            }
        });
        
        console.log('Linked NET courses found:', Array.from(linkedNetCourses));
        
        // Look for NET course mentions in text that aren't linked
        const netPattern = /NET(\d+):\s*([^,\n\r<>]+)/gi;
        let match;
        
        console.log('Searching for NET patterns in HTML...');
        
        while ((match = netPattern.exec(html)) !== null) {
            const netCode = `NET${match[1]}`; // e.g., "NET2110"
            const netTitle = match[2].trim(); // e.g., "Telecommunications 1"
            const netUrl = `https://bev.facey.rocks/${netCode}.html`;
            
            console.log(`Found NET course in text: ${netCode}: ${netTitle}`);
            
            // Only add if it's not already linked and hasn't been seen globally
            if (!linkedNetCourses.has(netCode) && !globalSeenHrefs.has(netUrl)) {
                console.log(`Adding NET course: ${netCode}`);
                try {
                    // Test if the NET course page exists
                    const testResponse = await fetch(netUrl, { method: 'HEAD' });
                    if (testResponse.ok) {
                        globalSeenHrefs.add(netUrl);
                        assignments.push({
                            href: netUrl,
                            name: `${netCode}: ${netTitle}`
                        });
                        console.log(`Successfully added: ${netCode}: ${netTitle}`);
                    } else {
                        console.log(`NET course ${netCode} page returned status: ${testResponse.status}`);
                    }
                } catch (e) {
                    // Page doesn't exist, skip it
                    console.log(`NET course ${netCode} page not found:`, e);
                }
            } else {
                console.log(`Skipping ${netCode} - already linked or seen globally`);
            }
        }
    }
    
    return assignments;
}

// update cookie and re-render assignments when an assignment is toggled
function toggleAssignment(courseUrl, assignmentHref) {
    const progress = getCookie(getCurrentCookieName());
    if (!progress[courseUrl]) {
        progress[courseUrl] = [];
    }
    
    const index = progress[courseUrl].indexOf(assignmentHref);
    if (index > -1) {
        progress[courseUrl].splice(index, 1);
    } else {
        progress[courseUrl].push(assignmentHref);
    }
    
    setCookie(getCurrentCookieName(), progress);
    renderAssignments();
}

function isCompleted(courseUrl, assignmentHref) {
    const progress = getCookie(getCurrentCookieName());
    return progress[courseUrl] && progress[courseUrl].includes(assignmentHref);
}

let allAssignments = {};

// load assignments from all courses
async function loadAssignments() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">Loading assignments...</div>';
    
    try {
        allAssignments = {};
        const globalSeenHrefs = new Set(); // Global duplicate tracking across all courses
        
        // Process courses in order (10, 20, 30) to prioritize earlier courses
        for (const course of COURSES) {
            try {
                const assignments = await fetchAssignments(course.url, globalSeenHrefs);
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
    const progress = getCookie(getCurrentCookieName());
    
    let totalAssignments = 0;
    let totalCompleted = 0;
    
    Object.values(allAssignments).forEach(course => {
        totalAssignments += course.assignments.length;
    });
    
    Object.values(progress).forEach(completed => {
        totalCompleted += completed.length;
    });
    
    const overallPercent = totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0;

    // calculate assignments needed per day based on how many completed and time left
    const now = new Date();
    const diff = END_DATE - now;
    const daysLeft = diff / (1000 * 60 * 60 * 24);
    const remaining = totalAssignments - totalCompleted;
    const perDay = (daysLeft > 0 && remaining > 0) ? (remaining / daysLeft).toFixed(2) : "0.00"; // round to 2 decimal places
    
    let html = `
        <div class="overall-stats">
            <h2>Overall Progress</h2>
            <p>${totalCompleted} of ${totalAssignments} completed (${overallPercent}%)</p>
        </div>
        <div class="countdown-section" style="background: none; padding: 10px; margin-bottom: 20px; box-shadow: none; display: flex; justify-content: center; gap: 40px;">
            <div style="text-align: center;">
                <h3 style="font-size: 1em; font-weight: normal; margin-bottom: 5px;">Time Until Last Day</h3>
                <div id="countdown" class="countdown" style="font-size: 1.2em; font-weight: normal;"></div>
            </div>
            <div style="text-align: center;">
                <h3 style="font-size: 1em; font-weight: normal; margin-bottom: 5px;">Assignments / Day</h3>
                <div style="font-size: 1.2em; font-weight: normal;">${perDay} needed</div>
            </div>
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
    updateCountdown();
}

// kinda useless but whatever
function clearProgress() {
    if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
        setCookie(getCurrentCookieName(), {});
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
        setCookie('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        setCookie('theme', 'light');
    }
}

toggleSwitch.addEventListener('change', switchTheme, false);

// Check for saved theme
const currentTheme = getCookie('theme');
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    toggleSwitch.checked = true;
}

// Check for saved course type
const savedCourseType = getCookie('selected_course_type');
if (savedCourseType && COURSE_TYPES[savedCourseType]) {
    currentCourseType = savedCourseType;
    COURSES = COURSE_TYPES[currentCourseType].courses;
}

// Initialize and start it up
loadAssignments();

// Update the course type display after DOM is loaded
setTimeout(() => {
    updateCourseTypeDisplay();
}, 100);

// keep the countdown updated every second
updateCountdown();
setInterval(updateCountdown, 1000);
