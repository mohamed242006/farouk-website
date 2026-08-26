import './style.css'

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <nav class="topbar">
      <a class="brand" href="/">
        <span class="brand-mark">S</span>
        <span>Sirr</span>
      </a>
      <div class="auth-actions" id="nav-actions">
        <div class="privacy-note"><span class="status-dot"></span>Private by design</div>
        <button class="text-button" id="inbox-nav-btn" hidden>Inbox</button>
        <button class="text-button" id="logout-btn" hidden>Sign out</button>
        <button class="text-button" id="signin-nav-btn">Sign in</button>
        <button class="outline-button" id="signup-nav-btn">Sign up</button>
      </div>
    </nav>

    <section class="hero" id="hero-section">
      <div class="eyebrow"><span></span> Educational Communication Platform</div>
      <h1 id="hero-title">Say what matters.<br><em>Stay unknown.</em></h1>
      <p class="intro">Send thoughts or questions to teachers anonymously.<br>Build confidence through open communication.</p>

      <div class="choice-grid">
        <button class="choice-card" id="btn-start-chat">
          <span class="card-topline"><span class="number">01</span><span class="arrow">↗</span></span>
          <span class="choice-title">Send Message<br><strong>to a Teacher</strong></span>
          <span class="choice-caption">Start a private, anonymous chat with your teacher.</span>
          <span class="card-action">Continue →</span>
        </button>
      </div>
    </section>

    <!-- Chat App UI Container -->
    <div class="chat-wrapper" id="chat-app" hidden>
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>Conversations</h3>
          <button class="outline-button small" id="btn-new-chat">+ New</button>
        </div>
        <div class="conversation-list" id="conv-list"></div>
      </div>
      <div class="chat-main">
        <div class="chat-header" id="chat-header">
          <span class="chat-title" id="active-chat-title">Select a chat</span>
          <button class="text-button danger" id="btn-delete-conv" hidden>Delete Chat</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <p class="empty-inbox">Select a conversation or start a new message.</p>
        </div>
        <div class="chat-input-area" id="chat-input-area" hidden>
          <input type="file" id="image-input" accept="image/*" hidden>
          <button class="icon-button" id="btn-attach-img" title="Send Image">📷</button>
          <input type="text" id="chat-message-input" placeholder="Write a message..." autocomplete="off">
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
        <div class="role-options" id="role-selector">
          <label><input type="radio" name="role" value="student" checked> Student</label>
          <label><input type="radio" name="role" value="teacher"> Teacher</label>
          <label><input type="radio" name="role" value="admin"> Admin</label>
        </div>
        <label class="form-field" id="username-field">Username<input name="username" type="text" placeholder="Unique student username"></label>
        <label class="form-field" id="teacher-name-field" hidden>Teacher Name<input name="displayName" type="text" placeholder="e.g. Mr. Ahmed"></label>
        <label class="form-field">Password<input name="password" type="password" required minlength="6"></label>
        <label class="form-field" id="access-code-field" hidden>Access Code<input name="accessCode" type="password" placeholder="Shared access code"></label>
        <button class="submit-button" type="submit" id="auth-submit-btn">Continue</button>
        <p class="form-message" id="auth-message"></p>
      </form>
    </section>
  </div>

  <!-- New Chat Modal -->
  <div class="modal-backdrop" id="new-chat-modal" hidden>
    <section class="modal">
      <div class="modal-header">
        <h2>Start Anonymous Chat</h2>
        <button class="close-button" id="btn-close-new-chat">×</button>
      </div>
      <form id="new-chat-form">
        <label class="form-field">Choose Teacher
          <select id="teacher-select" required></select>
        </label>
        <label class="form-field">First Message
          <textarea id="first-message-input" rows="4" required placeholder="Type your anonymous message..."></textarea>
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
const roleRadios = document.querySelectorAll('input[name="role"]')
const chatApp = document.querySelector('#chat-app')
const heroSection = document.querySelector('#hero-section')
const convList = document.querySelector('#conv-list')
const chatMessages = document.querySelector('#chat-messages')
const activeChatTitle = document.querySelector('#active-chat-title')
const chatInputArea = document.querySelector('#chat-input-area')
const msgInput = document.querySelector('#chat-message-input')
const btnDeleteConv = document.querySelector('#btn-delete-conv')

// Role Option Listener
roleRadios.forEach(r => r.addEventListener('change', (e) => {
  const role = e.target.value
  document.querySelector('#username-field').hidden = (role !== 'student')
  document.querySelector('#teacher-name-field').hidden = (role === 'student')
  document.querySelector('#access-code-field').hidden = (role === 'student')
}))

// Auth Flow
function openAuth(signup = true) {
  isSignup = signup
  authModal.hidden = false
  document.querySelector('#auth-title').textContent = signup ? 'Create Account' : 'Welcome Back'
  document.querySelector('#role-selector').hidden = !signup
}

document.querySelector('#signup-nav-btn').onclick = () => openAuth(true)
document.querySelector('#signin-nav-btn').onclick = () => openAuth(false)
document.querySelector('#btn-close-auth').onclick = () => authModal.hidden = true
document.querySelector('#btn-close-new-chat').onclick = () => newChatModal.hidden = true

authForm.onsubmit = async (e) => {
  e.preventDefault()
  const formData = Object.fromEntries(new FormData(authForm))
  const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/signin'

  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    authModal.hidden = true
    await checkSession()
  } catch (err) {
    document.querySelector('#auth-message').textContent = err.message
  }
}

document.querySelector('#logout-btn').onclick = async () => {
  await fetch('/api/auth/signout', { method: 'POST' })
  currentUser = null
  updateUI()
}

// Session
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
  document.querySelector('#inbox-nav-btn').hidden = !loggedIn

  if (loggedIn) {
    heroSection.hidden = true
    chatApp.hidden = false
    loadConversations()
  } else {
    heroSection.hidden = false
    chatApp.hidden = true
  }
}

// Chat System
async function loadConversations() {
  const res = await fetch('/api/conversations')
  const data = await res.json()
  convList.innerHTML = ''

  if (!data.conversations?.length) {
    convList.innerHTML = '<p class="empty-inbox">No active chats.</p>'
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

    if (m.type === 'image') {
      bubble.innerHTML = `<img src="${m.content}" class="chat-image" />`
    } else {
      bubble.textContent = m.content
    }
    chatMessages.appendChild(bubble)
  })
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Send Message
document.querySelector('#btn-send-msg').onclick = async () => {
  const text = msgInput.value.trim()
  if (!text || !activeConvId) return

  await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: activeConvId, content: text, type: 'text' })
  })

  msgInput.value = ''
  openConversation(activeConvId, activeChatTitle.textContent)
}

// New Chat Trigger
document.querySelector('#btn-start-chat').onclick = () => {
  if (!currentUser) {
    openAuth(true)
  } else {
    openNewChatModal()
  }
}
document.querySelector('#btn-new-chat').onclick = openNewChatModal

async function openNewChatModal() {
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

// Attach Image
document.querySelector('#btn-attach-img').onclick = () => document.querySelector('#image-input').click()
document.querySelector('#image-input').onchange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConvId, content: reader.result, type: 'image' })
    })
    openConversation(activeConvId, activeChatTitle.textContent)
  }
  reader.readAsDataURL(file)
}

// Delete Chat
btnDeleteConv.onclick = async () => {
  if (!activeConvId) return
  await fetch(`/api/conversations/${activeConvId}`, { method: 'DELETE' })
  activeConvId = null
  chatInputArea.hidden = true
  btnDeleteConv.hidden = true
  activeChatTitle.textContent = 'Select a chat'
  chatMessages.innerHTML = '<p class="empty-inbox">Conversation deleted.</p>'
  loadConversations()
}

checkSession()