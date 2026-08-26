import './style.css'

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <nav class="topbar">
      <a class="brand" href="/">
        <span class="brand-mark">S</span>
        <span>Sirr</span>
      </a>
      <div class="auth-actions">
        <div class="privacy-note"><span class="status-dot"></span>Private by design</div>
        <button class="text-button" id="logout-btn" hidden>Sign out</button>
        <button class="text-button" id="signin-nav-btn">Sign in</button>
        <button class="outline-button" id="signup-nav-btn">Sign up</button>
      </div>
    </nav>

    <!-- Public Landing Page -->
    <section class="hero" id="public-hero">
      <div class="eyebrow"><span></span> Educational Communication Platform</div>
      <h1>Say what matters.<br><em>Stay unknown.</em></h1>
      <p class="intro">Send thoughts, notes, or questions to your teachers with complete anonymity.<br>Build confidence through honest, embarrassment-free dialog.</p>

      <div class="hero-actions">
        <button class="hero-cta-button" id="btn-hero-start">Start Communicating Now →</button>
      </div>
    </section>

    <!-- Authenticated Chat Dashboard -->
    <div class="chat-wrapper" id="chat-app" hidden>
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>Inbox</h3>
          <button class="outline-button small" id="btn-new-chat-trigger" hidden>+ New Chat</button>
        </div>
        <div class="conversation-list" id="conv-list"></div>
      </div>
      <div class="chat-main">
        <div class="chat-header">
          <span class="chat-title" id="active-chat-title">Select a conversation</span>
          <button class="text-button danger" id="btn-delete-conv" hidden>Delete Chat</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <p class="empty-inbox">Choose a conversation from the sidebar to view messages.</p>
        </div>
        <div class="chat-input-area" id="chat-input-area" hidden>
          <input type="text" id="chat-message-input" placeholder="Type your message..." autocomplete="off">
          <button class="submit-button" id="btn-send-msg">Send</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Auth Modal -->
  <div class="modal-backdrop" id="auth-modal" hidden>
    <section class="modal">
      <div class="modal-header">
        <h2 id="auth-title">Welcome to Sirr</h2>
        <button class="close-button" id="btn-close-auth">×</button>
      </div>
      
      <form id="auth-form">
        <div class="custom-role-selector">
          <label class="role-card active">
            <input type="radio" name="role" value="student" checked>
            <span class="role-icon">🎓</span>
            <span class="role-label">Student</span>
          </label>
          <label class="role-card">
            <input type="radio" name="role" value="teacher">
            <span class="role-icon">👨‍🏫</span>
            <span class="role-label">Teacher</span>
          </label>
          <label class="role-card">
            <input type="radio" name="role" value="admin">
            <span class="role-icon">🛡️</span>
            <span class="role-label">Admin</span>
          </label>
        </div>

        <div id="dynamic-fields">
          <label class="form-field" id="field-username">Username<input name="username" type="text" placeholder="Enter student username"></label>
          <label class="form-field" id="field-teacher-name" hidden>Teacher Name<input name="displayName" type="text" placeholder="e.g. Mr. Ahmed"></label>
          <label class="form-field" id="field-password">Password<input name="password" type="password" minlength="6"></label>
          <label class="form-field" id="field-access-code" hidden>Access Code<input name="accessCode" type="password" placeholder="Shared access code"></label>
        </div>

        <button class="submit-button" type="submit" id="auth-submit-btn">Continue</button>
        <p class="form-message" id="auth-message"></p>
      </form>
    </section>
  </div>

  <!-- New Chat Modal -->
  <div class="modal-backdrop" id="new-chat-modal" hidden>
    <section class="modal">
      <div class="modal-header">
        <h2>Start Anonymous Message</h2>
        <button class="close-button" id="btn-close-new-chat">×</button>
      </div>
      <form id="new-chat-form">
        <label class="form-field">Choose Teacher
          <select id="teacher-select" required></select>
        </label>
        <label class="form-field">Message
          <textarea id="first-message-input" rows="4" required placeholder="Write your question or note anonymously..."></textarea>
        </label>
        <button class="submit-button" type="submit">Send Anonymously</button>
      </form>
    </section>
  </div>
`

// State
let currentUser = null
let activeConvId = null
let isSignup = true

// Elements
const authModal = document.querySelector('#auth-modal')
const newChatModal = document.querySelector('#new-chat-modal')
const authForm = document.querySelector('#auth-form')
const roleCards = document.querySelectorAll('.role-card')
const publicHero = document.querySelector('#public-hero')
const chatApp = document.querySelector('#chat-app')
const convList = document.querySelector('#conv-list')
const chatMessages = document.querySelector('#chat-messages')
const activeChatTitle = document.querySelector('#active-chat-title')
const chatInputArea = document.querySelector('#chat-input-area')
const msgInput = document.querySelector('#chat-message-input')
const btnDeleteConv = document.querySelector('#btn-delete-conv')
const btnNewChatTrigger = document.querySelector('#btn-new-chat-trigger')

// Dynamic Role Switching
roleCards.forEach(card => {
  card.addEventListener('click', () => {
    roleCards.forEach(c => c.classList.remove('active'))
    card.classList.add('active')
    const input = card.querySelector('input')
    input.checked = true
    updateDynamicFields(input.value)
  })
})

function updateDynamicFields(role) {
  const fUsername = document.querySelector('#field-username')
  const fTeacherName = document.querySelector('#field-teacher-name')
  const fPassword = document.querySelector('#field-password')
  const fAccessCode = document.querySelector('#field-access-code')

  if (role === 'student') {
    fUsername.hidden = false
    fPassword.hidden = false
    fTeacherName.hidden = true
    fAccessCode.hidden = true
  } else if (role === 'teacher') {
    fUsername.hidden = true
    fPassword.hidden = true
    fTeacherName.hidden = false
    fAccessCode.hidden = false
  } else if (role === 'admin') {
    fUsername.hidden = true
    fPassword.hidden = true
    fTeacherName.hidden = true
    fAccessCode.hidden = false
  }
}

// Auth Handlers
function openAuth(signup = true) {
  isSignup = signup
  authModal.hidden = false
  document.querySelector('#auth-title').textContent = signup ? 'Create Account' : 'Welcome Back'
  document.querySelector('.custom-role-selector').hidden = !signup
  const currentRole = document.querySelector('input[name="role"]:checked').value
  updateDynamicFields(signup ? currentRole : 'student')
}

document.querySelector('#signup-nav-btn').onclick = () => openAuth(true)
document.querySelector('#signin-nav-btn').onclick = () => openAuth(false)
document.querySelector('#btn-hero-start').onclick = () => openAuth(true)
document.querySelector('#btn-close-auth').onclick = () => authModal.hidden = true
document.querySelector('#btn-close-new-chat').onclick = () => newChatModal.hidden = true

authForm.onsubmit = async (e) => {
  e.preventDefault()
  const msgElem = document.querySelector('#auth-message')
  msgElem.textContent = 'Processing...'

  const formData = Object.fromEntries(new FormData(authForm))
  const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/signin'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    let data
    try {
      data = await res.json()
    } catch {
      throw new Error('Server returned an invalid response format.')
    }

    if (!res.ok) throw new Error(data.error || 'Authentication failed.')

    authModal.hidden = true
    msgElem.textContent = ''
    await checkSession()
  } catch (err) {
    msgElem.textContent = err.message
  }
}

document.querySelector('#logout-btn').onclick = async () => {
  await fetch('/api/auth/signout', { method: 'POST' })
  currentUser = null
  updateUI()
}

async function checkSession() {
  try {
    const res = await fetch('/api/session')
    if (res.ok) {
      const data = await res.json()
      currentUser = data.user
    } else {
      currentUser = null
    }
  } catch {
    currentUser = null
  }
  updateUI()
}

function updateUI() {
  const loggedIn = !!currentUser
  document.querySelector('#signin-nav-btn').hidden = loggedIn
  document.querySelector('#signup-nav-btn').hidden = loggedIn
  document.querySelector('#logout-btn').hidden = !loggedIn

  if (loggedIn) {
    publicHero.hidden = true
    chatApp.hidden = false
    btnNewChatTrigger.hidden = !(currentUser.role === 'student' || currentUser.role === 'admin')
    loadConversations()
  } else {
    publicHero.hidden = false
    chatApp.hidden = true
  }
}

async function loadConversations() {
  const res = await fetch('/api/conversations')
  const data = await res.json()
  convList.innerHTML = ''

  if (!data.conversations?.length) {
    convList.innerHTML = '<p class="empty-inbox">No messages found.</p>'
    return
  }

  data.conversations.forEach(c => {
    const item = document.createElement('div')
    item.className = `conv-item ${c.id === activeConvId ? 'active' : ''}`
    item.innerHTML = `<strong>${c.title}</strong><small>${new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>`
    item.onclick = () => openConversation(c.id, c.title)
    convList.appendChild(item)
  })
}

async function openConversation(id, title) {
  activeConvId = id
  activeChatTitle.textContent = title
  chatInputArea.hidden = false
  btnDeleteConv.hidden = false
  loadConversations()

  const res = await fetch(`/api/conversations/${id}/messages`)
  const data = await res.json()

  chatMessages.innerHTML = ''
  data.messages.forEach(m => {
    const bubble = document.createElement('div')
    const isMe = String(m.senderId) === String(currentUser.id)
    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`
    bubble.textContent = m.content
    chatMessages.appendChild(bubble)
  })
  chatMessages.scrollTop = chatMessages.scrollHeight
}

document.querySelector('#btn-send-msg').onclick = async () => {
  const text = msgInput.value.trim()
  if (!text || !activeConvId) return

  await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: activeConvId, content: text })
  })

  msgInput.value = ''
  openConversation(activeConvId, activeChatTitle.textContent)
}

btnNewChatTrigger.onclick = async () => {
  const res = await fetch('/api/teachers')
  const data = await res.json()
  const select = document.querySelector('#teacher-select')
  select.innerHTML = data.teachers.map(t => `<option value="${t._id}">${t.displayName}</option>`).join('')
  newChatModal.hidden = false
}

document.querySelector('#new-chat-form').onsubmit = async (e) => {
  e.preventDefault()
  const teacherId = document.querySelector('#teacher-select').value
  const content = document.querySelector('#first-message-input').value

  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId, content })
  })
  const data = await res.json()
  newChatModal.hidden = true
  await loadConversations()
  openConversation(data.conversationId, 'Teacher')
}

btnDeleteConv.onclick = async () => {
  if (!activeConvId) return
  await fetch(`/api/conversations/${activeConvId}`, { method: 'DELETE' })
  activeConvId = null
  chatInputArea.hidden = true
  btnDeleteConv.hidden = true
  activeChatTitle.textContent = 'Select a conversation'
  chatMessages.innerHTML = '<p class="empty-inbox">Chat removed.</p>'
  loadConversations()
}

checkSession()