import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const app = express()
const port = process.env.PORT || 3000
const secret = process.env.SESSION_SECRET
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const normalizePhone = (phone) => String(phone || '').replace(/[\s()-]/g, '')

const userSchema = new mongoose.Schema({ displayName: { type: String, required: true, trim: true, maxlength: 80 }, phone: { type: String, required: true, unique: true }, role: { type: String, enum: ['teacher', 'student'], required: true }, passwordHash: { type: String, required: true } }, { timestamps: true })
const otpSchema = new mongoose.Schema({ phone: { type: String, required: true, unique: true }, codeHash: { type: String, required: true }, displayName: String, role: { type: String, enum: ['teacher', 'student'] }, passwordHash: String, expiresAt: { type: Date, required: true, index: { expires: 0 } } })
const messageSchema = new mongoose.Schema({ senderId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, recipientIds: [{ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }], recipientRole: { type: String, enum: ['teacher', 'student'], required: true }, content: { type: String, required: true, maxlength: 2000 } }, { timestamps: true })
const User = mongoose.model('User', userSchema)
const Otp = mongoose.model('Otp', otpSchema)
const Message = mongoose.model('Message', messageSchema)

const sendOtp = async (phone, code) => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) throw new Error('SMS delivery is not configured. Add the Twilio settings to .env.')
    const body = new URLSearchParams({ To: phone, From: process.env.TWILIO_FROM_NUMBER, Body: `Your Sirr confirmation code is ${code}. It expires in 10 minutes.` })
    const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const sms = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    if (!sms.ok) throw new Error('The confirmation SMS could not be sent. Check your phone number and SMS settings.')
}
const auth = async (request, response, next) => { try { request.user = jwt.verify(request.cookies.sirr_session, secret); if (!(await User.exists({ _id: request.user.sub }))) throw new Error(); next() } catch { response.status(401).json({ error: 'Please sign in first.' }) } }

app.use(express.json({ limit: '12kb' }))
app.use(cookieParser())
app.use(express.static(path.join(rootDir, 'dist')))
app.post('/api/auth/signup', async (request, response) => {
    try {
        const phone = normalizePhone(request.body.phone); const { password, role, teacherKey, displayName } = request.body
        if (!/^\+?[1-9]\d{7,14}$/.test(phone) || !password || password.length < 8 || !displayName?.trim() || !['teacher', 'student'].includes(role)) return response.status(400).json({ error: 'Enter your name, a valid phone, 8+ character password, and role.' })
        if (role === 'teacher' && (!process.env.TEACHER_ACCESS_CODE || teacherKey !== process.env.TEACHER_ACCESS_CODE)) return response.status(403).json({ error: 'The teacher access code is not correct.' })
        if (await User.exists({ phone })) return response.status(409).json({ error: 'This phone number is already registered.' })
        const code = String(crypto.randomInt(100000, 1000000))
        await Otp.findOneAndUpdate({ phone }, { phone, codeHash: await bcrypt.hash(code, 10), role, displayName: displayName.trim(), passwordHash: await bcrypt.hash(password, 12), expiresAt: new Date(Date.now() + 10 * 60 * 1000) }, { upsert: true })
        try { await sendOtp(phone, code) } catch (error) { await Otp.deleteOne({ phone }); return response.status(503).json({ error: error.message }) }
        response.json({ message: 'Confirmation code sent to your mobile.' })
    } catch { response.status(500).json({ error: 'Could not start registration.' }) }
})
app.post('/api/auth/verify', async (request, response) => { const phone = normalizePhone(request.body.phone); const pending = await Otp.findOne({ phone }); if (!pending || pending.expiresAt < new Date() || !(await bcrypt.compare(String(request.body.otp), pending.codeHash))) return response.status(400).json({ error: 'That confirmation code is invalid or expired.' }); const user = await User.create({ phone, displayName: pending.displayName, role: pending.role, passwordHash: pending.passwordHash }); await Otp.deleteOne({ _id: pending._id }); response.cookie('sirr_session', jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }).json({ message: 'Account verified.' }) })
app.post('/api/auth/signin', async (request, response) => { const user = await User.findOne({ phone: normalizePhone(request.body.phone) }); if (!user || !(await bcrypt.compare(request.body.password || '', user.passwordHash))) return response.status(401).json({ error: 'Phone number or password is incorrect.' }); response.cookie('sirr_session', jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }).json({ message: 'Signed in.' }) })
app.post('/api/auth/signout', (request, response) => response.clearCookie('sirr_session').json({ message: 'Signed out.' }))
app.get('/api/session', auth, async (request, response) => { const user = await User.findById(request.user.sub).select('displayName role'); response.json({ user }) })
app.get('/api/recipients', auth, async (request, response) => { const role = request.query.role; if (!['teacher', 'student'].includes(role)) return response.status(400).json({ error: 'Invalid recipient role.' }); const recipients = await User.find({ role }).select('displayName role').sort('displayName'); response.json({ recipients }) })
app.get('/api/messages', auth, async (request, response) => { const messages = await Message.find({ recipientIds: request.user.sub }).sort({ createdAt: -1 }).lean(); response.json({ messages: messages.map((message) => ({ ...message, senderName: 'Anonymous' })) }) })
app.post('/api/messages', auth, async (request, response) => { const content = String(request.body.content || '').trim(); const role = request.body.recipientRole; const recipientIds = request.body.sendToAll ? (await User.find({ role, _id: { $ne: request.user.sub } }).select('_id')).map((user) => user._id) : [request.body.recipientId]; if (!['teacher', 'student'].includes(role) || !recipientIds.length || recipientIds.includes(undefined) || content.length < 1 || content.length > 2000) return response.status(400).json({ error: 'Choose a recipient and write a message under 2,000 characters.' }); await Message.create({ senderId: request.user.sub, recipientIds, recipientRole: role, content }); response.status(201).json({ message: 'Sent anonymously.' }) })
app.get('*', (request, response) => response.sendFile(path.join(rootDir, 'dist', 'index.html')))

if (!secret) throw new Error('SESSION_SECRET is required.')
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.')
mongoose.connect(process.env.MONGODB_URI).then(() => app.listen(port, () => console.log(`Sirr listening on http://localhost:${port}`))).catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1) })
