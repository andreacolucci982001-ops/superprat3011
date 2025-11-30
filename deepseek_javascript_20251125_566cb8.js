// CONFIGURAZIONE SUPABASE
const supabaseUrl = 'https://pjpwwjahkagakovsrexx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcHd3amFoa2FnYWtvdnNyZXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTE0MTcsImV4cCI6MjA3OTAyNzQxN30.OqG2DhCGaQ0YeogxU3Z1kBRdbN_ZHWom8Xt48JkfJ4w';

// Application data
let supabase;
let exercises = [];
let events = [];
let topics = new Set();
let tutors = new Set();
let optionCounter = 2;
let currentExerciseIndex = 0;

// Genera un ID utente unico per ogni dispositivo
let currentUser = localStorage.getItem('superpractice_user_id');
if (!currentUser) {
    currentUser = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('superpractice_user_id', currentUser);
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    // Inizializza Supabase se disponibile
    if (typeof supabaseClient !== 'undefined') {
        supabase = supabaseClient.createClient(supabaseUrl, supabaseKey);
    }
    
    await loadDataFromSupabase(); // Carica da Supabase
    
    initializeNavigation();
    loadStormExercises();
    loadNativeExercises();
    loadEvents();
    updateFilters();
    
    // Form handling
    document.getElementById('exercise-form').addEventListener('submit', function(e) {
        e.preventDefault();
        publishExercise();
    });
    
    // Tandem request toggle
    document.getElementById('tandem-request').addEventListener('change', function() {
        document.getElementById('tandem-details').classList.toggle('hidden', !this.checked);
    });
    
    // Answer type toggle
    document.getElementById('answer-type').addEventListener('change', function() {
        const isMultipleChoice = this.value === 'multiple';
        document.getElementById('multiple-choice-section').classList.toggle('hidden', !isMultipleChoice);
        document.getElementById('open-answer-section').classList.toggle('hidden', isMultipleChoice);
        
        if (!isMultipleChoice) {
            document.getElementById('correction-type').value = 'native';
            document.getElementById('correction-type').disabled = true;
        } else {
            document.getElementById('correction-type').disabled = false;
        }
    });
    
    // Correction type toggle
    document.getElementById('correction-type').addEventListener('change', function() {
        if (this.value === 'auto') {
            document.getElementById('answer-type').value = 'multiple';
            document.getElementById('multiple-choice-section').classList.remove('hidden');
            document.getElementById('open-answer-section').classList.add('hidden');
        }
    });
    
    // Filter handling
    document.getElementById('filter-language').addEventListener('change', filterContent);
    document.getElementById('filter-topic').addEventListener('change', filterContent);
    document.getElementById('filter-tutor').addEventListener('change', filterContent);
    document.getElementById('filter-city').addEventListener('input', filterEvents);
    
    initializeSampleData();
});

// FUNZIONI SUPABASE
async function loadDataFromSupabase() {
    // Prima prova a caricare da localStorage per velocità
    loadFromLocalStorage();
    
    if (!supabase) {
        console.log('Supabase non disponibile, uso localStorage');
        return;
    }

    try {
        console.log('🔄 Caricamento dati da Supabase...');
        
        // Carica esercizi
        const { data: exercisesData, error: exercisesError } = await supabase
            .from('exercises')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!exercisesError && exercisesData) {
            exercises = exercisesData;
            console.log(`✅ Caricati ${exercisesData.length} esercizi da Supabase`);
        } else {
            console.log('📁 Caricamento esercizi da localStorage');
        }
        
        // Carica eventi
        const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (!eventsError && eventsData) {
            events = eventsData;
            console.log(`✅ Caricati ${eventsData.length} eventi da Supabase`);
        } else {
            console.log('📁 Caricamento eventi da localStorage');
        }
        
    } catch (error) {
        console.log('❌ Errore Supabase, uso localStorage:', error);
    }
}

function loadFromLocalStorage() {
    const storedExercises = localStorage.getItem('superpractice_exercises');
    const storedEvents = localStorage.getItem('superpractice_events');
    
    if (storedExercises) {
        exercises = JSON.parse(storedExercises);
    }
    if (storedEvents) {
        events = JSON.parse(storedEvents);
    }
}

async function saveExercisesToSupabase() {
    // Salva sempre in localStorage per backup
    localStorage.setItem('superpractice_exercises', JSON.stringify(exercises));
    
    if (!supabase) {
        console.log('Supabase non disponibile, salvo solo in localStorage');
        return;
    }

    try {
        for (const exercise of exercises) {
            const { error } = await supabase
                .from('exercises')
                .upsert({
                    id: exercise.id,
                    created_at: exercise.createdAt || new Date().toISOString(),
                    creator: exercise.creator,
                    language: exercise.language,
                    topic: exercise.topic,
                    correction_type: exercise.correctionType,
                    question: exercise.question,
                    answer_type: exercise.answerType,
                    options: exercise.options,
                    explanation: exercise.explanation,
                    tandem_request: exercise.tandemRequest || false,
                    tandem_details: exercise.tandemDetails,
                    user_answers: exercise.userAnswers || {},
                    user_open_answers: exercise.userOpenAnswers || {},
                    corrections: exercise.corrections || []
                }, {
                    onConflict: 'id'
                });
            
            if (error) throw error;
        }
        console.log('✅ Esercizi salvati su Supabase');
    } catch (error) {
        console.error('❌ Errore Supabase:', error);
    }
}

async function saveEventsToSupabase() {
    // Salva sempre in localStorage per backup
    localStorage.setItem('superpractice_events', JSON.stringify(events));
    
    if (!supabase) {
        console.log('Supabase non disponibile, salvo solo in localStorage');
        return;
    }

    try {
        for (const event of events) {
            const { error } = await supabase
                .from('events')
                .upsert({
                    id: event.id,
                    created_at: event.createdAt || new Date().toISOString(),
                    title: event.title,
                    date: event.date,
                    location_type: event.locationType,
                    location: event.location,
                    city: event.city,
                    address: event.address,
                    language: event.language,
                    description: event.description,
                    participants: event.participants || []
                }, {
                    onConflict: 'id'
                });
            
            if (error) throw error;
        }
        console.log('✅ Eventi salvati su Supabase');
    } catch (error) {
        console.error('❌ Errore Supabase:', error);
    }
}

function saveExercises() {
    saveExercisesToSupabase();
}

function saveEvents() {
    saveEventsToSupabase();
}

// Navigation
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(targetSection).classList.add('active');
            
            if (targetSection === 'practice-native') {
                loadNativeExercises();
            } else if (targetSection === 'events-exchanges') {
                loadEvents();
            }
        });
    });
}

// Option management
function addOption() {
    optionCounter++;
    const optionsContainer = document.getElementById('options-container');
    const optionItem = document.createElement('div');
    optionItem.className = 'option-item';
    optionItem.innerHTML = `
        <input type="text" class="option-input" placeholder="Option ${optionCounter}" required>
        <button type="button" class="btn-delete" onclick="removeOption(this)">Delete</button>
    `;
    optionsContainer.appendChild(optionItem);
    
    updateCorrectOptionDropdown();
}

function removeOption(button) {
    const optionItem = button.parentElement;
    if (document.querySelectorAll('.option-item').length > 1) {
        optionItem.remove();
        optionCounter--;
        updateCorrectOptionDropdown();
    } else {
        alert('At least one option is required!');
    }
}

function updateCorrectOptionDropdown() {
    const select = document.getElementById('correct-option');
    select.innerHTML = '';
    
    const options = document.querySelectorAll('.option-input');
    options.forEach((option, index) => {
        const optionElement = document.createElement('option');
        optionElement.value = index + 1;
        optionElement.textContent = `Option ${index + 1}`;
        select.appendChild(optionElement);
    });
}

// Exercise publishing
function publishExercise() {
    const name = document.getElementById('creator-name').value.trim();
    const language = document.getElementById('exercise-language').value;
    const topic = document.getElementById('exercise-topic').value.trim();
    const correctionType = document.getElementById('correction-type').value;
    const question = document.getElementById('question').value.trim();
    const explanation = document.getElementById('explanation').value.trim();
    const answerType = document.getElementById('answer-type').value;
    const tandemRequest = document.getElementById('tandem-request').checked;
    const tandemLanguages = document.getElementById('tandem-languages').value;
    const tandemSchedule = document.getElementById('tandem-schedule').value;
    
    let options = [];
    let correctOptionIndex = -1;
    
    if (answerType === 'multiple') {
        const optionInputs = document.querySelectorAll('.option-input');
        options = Array.from(optionInputs).map(input => input.value.trim());
        correctOptionIndex = parseInt(document.getElementById('correct-option').value) - 1;
        
        if (options.length < 2) {
            alert('Add at least 2 options!');
            return;
        }
    }
    
    // Validation
    if (!name || !language || !topic || !question) {
        alert('Please fill all required fields!');
        return;
    }
    
    // Add topic to filters
    topics.add(topic);
    tutors.add(name);
    updateFilters();
    
    const exercise = {
        id: Date.now(),
        creator: name,
        language,
        topic,
        correctionType,
        question,
        answerType,
        options: answerType === 'multiple' ? options.map((text, index) => ({
            text,
            correct: index === correctOptionIndex
        })) : [],
        explanation,
        createdAt: new Date().toISOString(),
        userAnswers: {},
        userOpenAnswers: {},
        requiresNativeCorrection: correctionType === 'native',
        tandemRequest: tandemRequest,
        tandemDetails: tandemRequest ? {
            languages: tandemLanguages,
            schedule: tandemSchedule
        } : null,
        corrections: []
    };
    
    exercises.unshift(exercise);
    saveExercises();
    loadStormExercises();
    loadNativeExercises();
    resetExerciseForm();
    
    alert('Exercise published successfully!');
}

function resetExerciseForm() {
    document.getElementById('exercise-form').reset();
    document.getElementById('options-container').innerHTML = `
        <div class="option-item">
            <input type="text" class="option-input" placeholder="Option 1" required>
            <button type="button" class="btn-delete" onclick="removeOption(this)">Delete</button>
        </div>
        <div class="option-item">
            <input type="text" class="option-input" placeholder="Option 2" required>
            <button type="button" class="btn-delete" onclick="removeOption(this)">Delete</button>
        </div>
    `;
    document.getElementById('tandem-details').classList.add('hidden');
    document.getElementById('multiple-choice-section').classList.remove('hidden');
    document.getElementById('open-answer-section').classList.add('hidden');
    document.getElementById('correction-type').disabled = false;
    optionCounter = 2;
    updateCorrectOptionDropdown();
}

// Storm exercises (auto-correction) - MODIFICATO: ogni utente vede solo le proprie risposte
function loadStormExercises() {
    const stormList = document.getElementById('storm-list');
    const stormCount = document.getElementById('storm-count');
    
    // Filter only auto-correction exercises
    let stormExercises = exercises.filter(ex => ex.correctionType === 'auto');
    
    // Apply additional filters
    const languageFilter = document.getElementById('filter-language').value;
    const topicFilter = document.getElementById('filter-topic').value;
    const tutorFilter = document.getElementById('filter-tutor').value;
    
    if (languageFilter) {
        stormExercises = stormExercises.filter(ex => ex.language === languageFilter);
    }
    
    if (topicFilter) {
        stormExercises = stormExercises.filter(ex => ex.topic === topicFilter);
    }
    
    if (tutorFilter) {
        stormExercises = stormExercises.filter(ex => ex.creator === tutorFilter);
    }
    
    if (stormExercises.length === 0) {
        stormList.innerHTML = '<p>No auto-correction exercises found with selected filters.</p>';
        stormCount.textContent = '0 exercises';
        return;
    }
    
    stormCount.textContent = `${stormExercises.length} exercises`;
    
    // Show current exercise
    const currentExercise = stormExercises[currentExerciseIndex];
    if (!currentExercise) {
        stormList.innerHTML = '<p>No exercises available.</p>';
        return;
    }
    
    // MODIFICA: ogni utente vede solo le proprie risposte
    const userAnswer = currentExercise.userAnswers?.[currentUser];
    const showResults = userAnswer !== undefined;
    const correctOptionIndex = currentExercise.options.findIndex(opt => opt.correct);
    const isCorrect = userAnswer === correctOptionIndex;
    
    stormList.innerHTML = `
        <div class="exercise-card">
            <div class="exercise-header">
                <div class="exercise-question">${currentExercise.question}</div>
                ${currentExercise.tandemRequest ? '<span class="tandem-badge">Tandem Available</span>' : ''}
            </div>
            
            <div class="exercise-meta">
                <span class="exercise-tag">${currentExercise.language}</span>
                <span class="exercise-tag">${currentExercise.topic}</span>
                <span class="exercise-tag">By: ${currentExercise.creator}</span>
            </div>
            
            ${currentExercise.tandemRequest ? `
                <div class="tandem-request">
                    <strong>🤝 Tandem Practice Available</strong>
                    <p>Creator is available for tandem practice in: ${currentExercise.tandemDetails.languages}</p>
                    <p>Preferred schedule: ${currentExercise.tandemDetails.schedule}</p>
                    <button class="next-exercise-btn" onclick="requestTandem(${currentExercise.id})">
                        Request Tandem Session
                    </button>
                </div>
            ` : ''}
            
            <div class="exercise-options">
                ${currentExercise.options.map((option, index) => {
                    let optionClass = 'option-item-user';
                    let feedback = '';
                    
                    if (showResults) {
                        if (option.correct) {
                            optionClass += ' correct';
                            feedback = '<div class="option-feedback">✓ Correct</div>';
                        } else if (userAnswer === index) {
                            optionClass += ' incorrect';
                            feedback = '<div class="option-feedback">✗ Incorrect</div>';
                        }
                    }
                    
                    return `
                        <div class="${optionClass}" onclick="selectStormOption(${currentExercise.id}, ${index})">
                            <div class="option-text">${String.fromCharCode(65 + index)}) ${option.text}</div>
                            ${feedback}
                        </div>
                    `;
                }).join('')}
            </div>
            
            ${showResults ? `
                <div class="feedback ${isCorrect ? 'correct' : 'incorrect'}">
                    ${isCorrect ? '🎉 Correct answer!' : '❌ Incorrect answer. Try again!'}
                </div>
                
                ${isCorrect ? `
                    <div class="exercise-explanation">
                        <strong>Explanation:</strong> ${currentExercise.explanation}
                    </div>
                    <button class="next-exercise-btn" onclick="nextStormExercise()">
                        Next Exercise →
                    </button>
                ` : ''}
            ` : ''}
        </div>
    `;
}

function selectStormOption(exerciseId, optionIndex) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    // Save user answer - MODIFICA: ogni utente ha le proprie risposte
    if (!exercise.userAnswers) {
        exercise.userAnswers = {};
    }
    exercise.userAnswers[currentUser] = optionIndex;
    
    // Show immediate feedback for auto-correction exercises
    const correctOptionIndex = exercise.options.findIndex(opt => opt.correct);
    const isCorrect = optionIndex === correctOptionIndex;
    
    if (isCorrect) {
        // Auto-show explanation for correct answers
        saveExercises();
        loadStormExercises();
    } else {
        // Show immediate feedback for incorrect answers
        saveExercises();
        loadStormExercises();
    }
}

function nextStormExercise() {
    const languageFilter = document.getElementById('filter-language').value;
    const topicFilter = document.getElementById('filter-topic').value;
    const tutorFilter = document.getElementById('filter-tutor').value;
    
    let stormExercises = exercises.filter(ex => ex.correctionType === 'auto');
    
    if (languageFilter) {
        stormExercises = stormExercises.filter(ex => ex.language === languageFilter);
    }
    
    if (topicFilter) {
        stormExercises = stormExercises.filter(ex => ex.topic === topicFilter);
    }
    
    if (tutorFilter) {
        stormExercises = stormExercises.filter(ex => ex.creator === tutorFilter);
    }
    
    currentExerciseIndex = (currentExerciseIndex + 1) % stormExercises.length;
    loadStormExercises();
}

// Practice with Native - Single Section
function loadNativeExercises() {
    const nativeList = document.getElementById('native-list');
    const nativeCount = document.getElementById('native-count');
    
    // Filter only native correction exercises
    let nativeExercises = exercises.filter(ex => ex.correctionType === 'native');
    
    // Apply additional filters
    const languageFilter = document.getElementById('filter-language').value;
    const topicFilter = document.getElementById('filter-topic').value;
    const tutorFilter = document.getElementById('filter-tutor').value;
    
    if (languageFilter) {
        nativeExercises = nativeExercises.filter(ex => ex.language === languageFilter);
    }
    
    if (topicFilter) {
        nativeExercises = nativeExercises.filter(ex => ex.topic === topicFilter);
    }
    
    if (tutorFilter) {
        nativeExercises = nativeExercises.filter(ex => ex.creator === tutorFilter);
    }
    
    if (nativeExercises.length === 0) {
        nativeList.innerHTML = '<p>No native correction exercises found with selected filters.</p>';
        nativeCount.textContent = '0 exercises';
        return;
    }
    
    nativeCount.textContent = `${nativeExercises.length} exercises`;
    
    nativeList.innerHTML = nativeExercises.map(exercise => {
        // MODIFICA: ogni utente vede solo le proprie risposte
        const userAnswer = exercise.userAnswers?.[currentUser];
        const userOpenAnswer = exercise.userOpenAnswers?.[currentUser];
        const hasAnswered = userAnswer !== undefined || userOpenAnswer !== undefined;
        const userCorrections = exercise.corrections ? exercise.corrections.filter(c => c.userId === currentUser) : [];
        
        return `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-question">${exercise.question}</div>
                    <span class="premium-badge">Native Correction</span>
                    ${exercise.tandemRequest ? '<span class="tandem-badge">Tandem Available</span>' : ''}
                </div>
                
                <div class="exercise-meta">
                    <span class="exercise-tag">${exercise.language}</span>
                    <span class="exercise-tag">${exercise.topic}</span>
                    <span class="exercise-tag">By: ${exercise.creator}</span>
                </div>
                
                ${!hasAnswered ? `
                    ${exercise.answerType === 'multiple' ? `
                        <div class="exercise-options">
                            ${exercise.options.map((option, index) => `
                                <div class="option-item-user" onclick="selectNativeOption(${exercise.id}, ${index})">
                                    <div class="option-text">${String.fromCharCode(65 + index)}) ${option.text}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="open-answer-section">
                            <h4>✍️ Write Your Answer</h4>
                            <textarea id="open-answer-${exercise.id}" placeholder="Write your answer here..." rows="4" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd;"></textarea>
                        </div>
                    `}
                    
                    <div class="form-actions">
                        <button class="next-exercise-btn" onclick="submitNativeAnswer(${exercise.id})">
                            Submit Answer for Native Correction
                        </button>
                    </div>
                ` : `
                    <div class="correction-item">
                        <strong>Your Answer:</strong>
                        <p>${userOpenAnswer || exercise.options[userAnswer].text}</p>
                    </div>
                    
                    ${userCorrections.length > 0 ? `
                        <div class="exercise-explanation">
                            <strong>Corrections:</strong>
                            ${userCorrections.map(correction => `
                                <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px;">
                                    <strong>${correction.nativeSpeaker}:</strong> ${correction.feedback}
                                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">
                                        ${new Date(correction.correctedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="correction-item">
                            <p><em>Your answer is waiting for native speaker correction.</em></p>
                        </div>
                    `}
                    
                    <!-- Chiunque può correggere -->
                    <div class="correction-form">
                        <h4>✏️ Provide Correction, Upload a link or Answer! </h4>
                        <div class="form-group">
                            <label>Your correction/feedback:</label>
                            <textarea id="correction-${exercise.id}" placeholder="Provide constructive feedback..." rows="4"></textarea>
                        </div>
                        <button class="next-exercise-btn" onclick="submitCorrection(${exercise.id})">
                            Submit Correction
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function selectNativeOption(exerciseId, optionIndex) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    // Save user answer - MODIFICA: ogni utente ha le proprie risposte
    if (!exercise.userAnswers) {
        exercise.userAnswers = {};
    }
    exercise.userAnswers[currentUser] = optionIndex;
    
    saveExercises();
    loadNativeExercises(); // Reload to show selection
}

function submitNativeAnswer(exerciseId) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    let userAnswer, userAnswerText;
    
    if (exercise.answerType === 'multiple') {
        userAnswer = exercise.userAnswers?.[currentUser];
        if (userAnswer === undefined) {
            alert('Please select an answer first!');
            return;
        }
        userAnswerText = exercise.options[userAnswer].text;
    } else {
        const openAnswerInput = document.getElementById(`open-answer-${exerciseId}`);
        userAnswerText = openAnswerInput.value.trim();
        if (!userAnswerText) {
            alert('Please write your answer first!');
            return;
        }
        if (!exercise.userOpenAnswers) {
            exercise.userOpenAnswers = {};
        }
        exercise.userOpenAnswers[currentUser] = userAnswerText;
    }
    
    saveExercises();
    loadNativeExercises();
    
    alert('Your answer has been submitted for native speaker correction!');
}

function submitCorrection(exerciseId) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    const correctionText = document.getElementById(`correction-${exerciseId}`).value.trim();
    if (!correctionText) {
        alert('Please provide correction feedback!');
        return;
    }
    
    // Update exercise with correction
    if (!exercise.corrections) {
        exercise.corrections = [];
    }
    exercise.corrections.push({
        nativeSpeaker: currentUser,
        userId: currentUser,
        feedback: correctionText,
        correctedAt: new Date().toISOString()
    });
    
    saveExercises();
    loadNativeExercises();
    
    alert('Correction submitted successfully!');
}

function requestTandem(exerciseId) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise && exercise.tandemRequest) {
        alert(`Tandem session requested with ${exercise.creator}! They will be notified of your interest in practicing ${exercise.topic}.`);
    }
}

// Events management
function showEventForm() {
    document.getElementById('event-form').classList.remove('hidden');
}

function hideEventForm() {
    document.getElementById('event-form').classList.add('hidden');
}

function saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const locationType = document.getElementById('location-type').value;
    const location = document.getElementById('event-location').value.trim();
    const city = document.getElementById('event-city').value.trim();
    const address = document.getElementById('event-address').value.trim();
    const language = document.getElementById('event-language').value;
    const description = document.getElementById('event-description').value.trim();
    
    if (!title || !date || !location || !city) {
        alert('Please fill all required fields!');
        return;
    }
    
    const event = {
        id: Date.now(),
        title,
        date: `${date} ${time}`,
        locationType,
        location,
        city,
        address,
        language,
        description,
        createdAt: new Date().toISOString(),
        participants: [currentUser]
    };
    
    events.unshift(event);
    saveEvents();
    loadEvents();
    hideEventForm();
    
    // Reset form
    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-city').value = '';
    document.getElementById('event-address').value = '';
    document.getElementById('event-description').value = '';
    
    alert('Event created successfully!');
}

function loadEvents() {
    const eventsList = document.getElementById('events-list');
    const cityFilter = document.getElementById('filter-city').value.toLowerCase();
    
    let filteredEvents = events;
    
    if (cityFilter) {
        filteredEvents = filteredEvents.filter(event => 
            event.city.toLowerCase().includes(cityFilter)
        );
    }
    
    if (filteredEvents.length === 0) {
        eventsList.innerHTML = '<p>No events found matching your search.</p>';
        return;
    }
    
    eventsList.innerHTML = filteredEvents.map(event => `
        <div class="event-card">
            <div class="event-title">${event.title}</div>
            <div class="event-date">📅 ${formatDateTime(event.date)}</div>
            <div class="event-location">
                📍 ${event.location} 
                <span class="location-badge">${event.locationType}</span>
            </div>
            <div class="event-location">🏙️ ${event.city} ${event.address ? `- ${event.address}` : ''}</div>
            <div class="exercise-tag">${event.language}</div>
            <div class="event-description">${event.description}</div>
            <div class="form-actions">
                <button class="next-exercise-btn" onclick="joinEvent(${event.id})">
                    Join Event
                </button>
                <span style="margin-left: 10px; color: #6c757d;">
                    ${event.participants.length} participants
                </span>
            </div>
        </div>
    `).join('');
}

function filterEvents() {
    loadEvents();
}

function joinEvent(eventId) {
    const event = events.find(ev => ev.id === eventId);
    if (event && !event.participants.includes(currentUser)) {
        event.participants.push(currentUser);
        saveEvents();
        loadEvents();
        alert('You have joined the event!');
    }
}

// Filters
function updateFilters() {
    const topicSelect = document.getElementById('filter-topic');
    const tutorSelect = document.getElementById('filter-tutor');
    
    topicSelect.innerHTML = '<option value="">All topics</option>';
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });
    
    tutorSelect.innerHTML = '<option value="">All tutors</option>';
    tutors.forEach(tutor => {
        const option = document.createElement('option');
        option.value = tutor;
        option.textContent = tutor;
        tutorSelect.appendChild(option);
    });
}

function filterContent() {
    currentExerciseIndex = 0;
    loadStormExercises();
    loadNativeExercises();
}

// Utility functions
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Sample data initialization
function initializeSampleData() {
    if (exercises.length === 0) {
        exercises = [
            {
                id: 1,
                creator: "Maria Bianchi",
                language: "english",
                topic: "Basic Grammar",
                correctionType: "auto",
                question: "What is the correct verb form for 'he' in present simple?",
                answerType: "multiple",
                options: [
                    { text: "He go to school", correct: false },
                    { text: "He goes to school", correct: true },
                    { text: "He going to school", correct: false }
                ],
                explanation: "For third person singular (he, she, it) in present simple, we add -s to the verb.",
                createdAt: new Date().toISOString(),
                userAnswers: {},
                requiresNativeCorrection: false,
                tandemRequest: true,
                tandemDetails: {
                    languages: "English, Italian",
                    schedule: "Weekends"
                },
                corrections: []
            },
            {
                id: 2,
                creator: "John Smith",
                language: "spanish",
                topic: "Vocabulary",
                correctionType: "native",
                question: "How would you describe your favorite place in Spanish?",
                answerType: "open",
                explanation: "This is a good answer because it uses descriptive vocabulary and explains why the place is favorite.",
                createdAt: new Date().toISOString(),
                userAnswers: {},
                userOpenAnswers: {},
                requiresNativeCorrection: true,
                tandemRequest: false,
                corrections: []
            }
        ];
        saveExercises();
    }
    
    if (events.length === 0) {
        events = [
            {
                id: 1,
                title: "English Conversation - Intermediate Level",
                date: "2024-12-20 18:00",
                locationType: "cafe",
                location: "Bookworm Cafe",
                city: "Rome",
                address: "Via del Corso 123",
                language: "english",
                description: "An informal meeting to practice spoken English. Bring your enthusiasm and willingness to converse!",
                createdAt: new Date().toISOString(),
                participants: []
            },
            {
                id: 2,
                title: "Spanish Language Exchange",
                date: "2024-12-22 17:00",
                locationType: "park",
                location: "Central Park",
                city: "Milan",
                address: "Piazza Duomo",
                language: "spanish",
                description: "Casual Spanish practice for all levels. Let's speak Spanish while enjoying the park!",
                createdAt: new Date().toISOString(),
                participants: []
            }
        ];
        saveEvents();
    }
    
    // Update filters
    exercises.forEach(exercise => {
        topics.add(exercise.topic);
        tutors.add(exercise.creator);
    });
    updateFilters();
}