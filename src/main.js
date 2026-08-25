import './style.css'

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <nav class="topbar" aria-label="Main navigation">
      <a class="brand" href="/" aria-label="Sirr home">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>Sirr</span>
      </a>
      <div class="auth-actions"><div class="privacy-note"><span class="status-dot"></span>Private by design</div><button class="text-button" id="inbox-button" type="button" hidden>Inbox</button><button class="text-button" id="logout-button" type="button" hidden>Sign out</button><button class="text-button" data-auth="signin" type="button">Sign in</button><button class="outline-button" data-auth="signup" type="button">Sign up</button></div>
    </nav>

    <section class="hero" aria-labelledby="hero-title">
      <div class="eyebrow"><span></span> A quiet line between people</div>
      <h1 id="hero-title">Say what matters.<br><em>Stay unknown.</em></h1>
      <p class="intro">Send a thought, question, or note without sharing your name.<br>Choose who it is for, and let the message speak for itself.</p>

      <div class="choice-grid" aria-label="Choose a recipient">
        <button class="choice-card choice-teacher" data-recipient="teacher" type="button">
          <span class="card-topline"><span class="number">01</span><span class="arrow" aria-hidden="true">↗</span></span>
          <span class="choice-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="m7 19 17-9 17 9-17 9-17-9Z"/><path d="M14 23v9c5 4 15 5 20 0v-9M41 20v12"/></svg></span>
          <span class="choice-title">I need to send<br><strong>to a teacher</strong></span>
          <span class="choice-caption">A private note for someone who guides you.</span>
          <span class="card-action">Continue <span aria-hidden="true">→</span></span>
        </button>
        <button class="choice-card choice-student" data-recipient="student" type="button">
          <span class="card-topline"><span class="number">02</span><span class="arrow" aria-hidden="true">↗</span></span>
          <span class="choice-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="16" r="7"/><path d="M11 39c1-8 6-12 13-12s12 4 13 12M37 11v10M32 16h10"/></svg></span>
          <span class="choice-title">I need to send<br><strong>to a student</strong></span>
          <span class="choice-caption">A private note for someone in your circle.</span>
          <span class="card-action">Continue <span aria-hidden="true">→</span></span>
        </button>
      </div>
      <p class="trust-line"><span class="lock" aria-hidden="true">⌑</span> No accounts. No names. No traces.</p>
    </section>

    <footer class="footer"><span>© 2026 Sirr</span><span class="footer-rule"></span><span>Made for honest words</span></footer>
  </main>
  <div class="modal-backdrop" id="auth-modal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div class="modal-header"><div><div class="eyebrow"><span></span> Private access</div><h2 id="auth-title">Welcome to Sirr</h2></div><button class="close-button" data-close type="button" aria-label="Close">×</button></div>
      <p class="modal-copy" id="auth-copy">Create an account to send anonymous notes.</p>
      <form id="auth-form">
        <label class="form-field" id="name-field">Your name<input name="displayName" type="text" autocomplete="name" placeholder="How people know you" required></label><label class="form-field">Mobile number<input name="phone" type="tel" autocomplete="tel" placeholder="+20 100 000 0000" required></label>
        <label class="form-field">Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <div class="role-options" id="role-options"><label class="role-option"><input name="role" value="student" type="radio" checked><span>I'm a student</span></label><label class="role-option"><input name="role" value="teacher" type="radio"><span>I'm a teacher</span></label></div>
        <label class="form-field" id="teacher-key-field" hidden>Teacher access code<input name="teacherKey" type="password" autocomplete="off" placeholder="Shared teacher code"></label>
        <label class="form-field" id="otp-field" hidden>6-digit confirmation code<input name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000"></label>
        <button class="submit-button" type="submit">Continue</button><p class="form-message" id="form-message" role="alert"></p>
      </form>
    </section>
  </div>
  <div class="modal-backdrop" id="message-modal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="message-title">
      <div class="modal-header"><div><div class="eyebrow"><span></span> Anonymous note</div><h2 id="message-title">To a student</h2></div><button class="close-button" data-message-close type="button" aria-label="Close">×</button></div>
      <p class="modal-copy">Your identity will not be shared with the recipient.</p>
      <form id="message-form"><label class="form-field">Send to<select id="recipient-select" name="recipientId" required></select></label><label class="send-all-option"><input id="send-all" name="sendToAll" type="checkbox"> Send to all <span id="recipient-role-label"></span></label><label class="form-field">Your message<textarea name="content" rows="6" maxlength="2000" placeholder="Write what you need to say..." required></textarea></label><button class="submit-button" type="submit">Send anonymously</button><p class="form-message" id="message-form-status" role="alert"></p></form>
    </section>
  </div>
  <section class="inbox-panel" id="inbox-panel" hidden><div class="inbox-heading"><div><div class="eyebrow"><span></span> Your private inbox</div><h2>Messages sent to you</h2></div><button class="close-button" id="inbox-close" type="button" aria-label="Close inbox">×</button></div><div id="inbox-list"></div></section>
  <div class="toast" role="status" aria-live="polite"></div>
`

const toast = document.querySelector('.toast')
const modal = document.querySelector('#auth-modal')
const form = document.querySelector('#auth-form')
const message = document.querySelector('#form-message')
const messageModal = document.querySelector('#message-modal')
const messageForm = document.querySelector('#message-form')
const messageStatus = document.querySelector('#message-form-status')
const authButtons = document.querySelectorAll('[data-auth]')
const inboxButton = document.querySelector('#inbox-button')
const logoutButton = document.querySelector('#logout-button')
const inboxPanel = document.querySelector('#inbox-panel')
const inboxList = document.querySelector('#inbox-list')
const recipientSelect = document.querySelector('#recipient-select')
const sendAll = document.querySelector('#send-all')
let authMode = 'signup'
let otpStep = false
let messageRecipient = ''

function openAuth(mode) {
  authMode = mode
  otpStep = false
  modal.hidden = false
  document.querySelector('#auth-title').textContent = mode === 'signup' ? 'Create your space' : 'Welcome back'
  document.querySelector('#auth-copy').textContent = mode === 'signup' ? 'A phone number is used only to protect your account.' : 'Sign in privately and continue where you left off.'
  document.querySelector('#role-options').hidden = mode === 'signin'
  document.querySelector('#name-field').hidden = mode === 'signin'
  document.querySelector('#name-field input').required = mode === 'signup'
  const selectedRole = document.querySelector('input[name="role"]:checked')?.value
  document.querySelector('#teacher-key-field').hidden = mode === 'signin' || selectedRole !== 'teacher'
  document.querySelector('#teacher-key-field input').required = mode === 'signup' && selectedRole === 'teacher'
  document.querySelector('#otp-field').hidden = true
  document.querySelector('#otp-field input').required = false
  message.textContent = ''
}

document.querySelectorAll('[data-auth]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.auth)))
document.querySelector('[data-close]').addEventListener('click', () => { modal.hidden = true })
modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true })
document.querySelector('[data-message-close]').addEventListener('click', () => { messageModal.hidden = true })
messageModal.addEventListener('click', (event) => { if (event.target === messageModal) messageModal.hidden = true })
document.querySelectorAll('input[name="role"]').forEach((input) => input.addEventListener('change', () => {
  const teacherSelected = input.value === 'teacher' && input.checked
  document.querySelector('#teacher-key-field').hidden = !teacherSelected
  document.querySelector('#teacher-key-field input').required = teacherSelected
}))

async function loadRecipients(role) {
  recipientSelect.innerHTML = '<option>Loading people...</option>'
  const response = await fetch(`/api/recipients?role=${role}`)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  recipientSelect.innerHTML = result.recipients.length ? result.recipients.map((recipient) => `<option value="${recipient._id}">${recipient.displayName}</option>`).join('') : '<option value="">No recipients registered yet</option>'
  document.querySelector('#recipient-role-label').textContent = `${role}s`
}

async function loadInbox() {
  const response = await fetch('/api/messages')
  const result = await response.json()
  inboxList.innerHTML = result.messages.length ? result.messages.map((item) => `<article class="inbox-message"><span>${new Date(item.createdAt).toLocaleString()}</span><p>${item.content.replaceAll('<', '&lt;')}</p></article>`).join('') : '<p class="empty-inbox">No messages have arrived yet.</p>'
  inboxPanel.hidden = false
}

async function refreshSession() {
  const response = await fetch('/api/session')
  const signedIn = response.ok
  authButtons.forEach((button) => { button.hidden = signedIn })
  inboxButton.hidden = !signedIn
  logoutButton.hidden = !signedIn
}

inboxButton.addEventListener('click', loadInbox)
document.querySelector('#inbox-close').addEventListener('click', () => { inboxPanel.hidden = true })
logoutButton.addEventListener('click', async () => { await fetch('/api/auth/signout', { method: 'POST' }); inboxPanel.hidden = true; refreshSession() })

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  message.textContent = 'Working securely...'
  const data = Object.fromEntries(new FormData(form))
  const endpoint = authMode === 'signup' && !otpStep ? '/api/auth/signup' : authMode === 'signup' ? '/api/auth/verify' : '/api/auth/signin'
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Something went wrong.')
    if (authMode === 'signup' && !otpStep) { otpStep = true; document.querySelector('#otp-field').hidden = false; document.querySelector('#otp-field input').required = true; message.textContent = 'Code sent to your mobile. Enter it to continue.'; return }
    modal.hidden = true
    refreshSession()
    toast.textContent = 'You are securely signed in.'
    toast.classList.add('is-visible')
    setTimeout(() => toast.classList.remove('is-visible'), 2800)
  } catch (error) { message.textContent = error.message }
})

document.querySelectorAll('.choice-card').forEach((card) => {
  card.addEventListener('click', () => {
    messageRecipient = card.dataset.recipient
    document.querySelector('#message-title').textContent = `To a ${messageRecipient}`
    messageStatus.textContent = ''
    messageForm.reset()
    sendAll.checked = false
    loadRecipients(messageRecipient).catch((error) => { messageStatus.textContent = error.message })
    messageModal.hidden = false
  })
})

messageForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  messageStatus.textContent = 'Sending securely...'
  try {
    const formData = new FormData(messageForm)
    const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientRole: messageRecipient, recipientId: formData.get('recipientId'), sendToAll: sendAll.checked, content: formData.get('content') }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Please sign in first.')
    messageModal.hidden = true
    toast.textContent = 'Your anonymous note was sent.'
    toast.classList.add('is-visible')
    setTimeout(() => toast.classList.remove('is-visible'), 2800)
  } catch (error) { messageStatus.textContent = error.message }
})

refreshSession()
