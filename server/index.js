import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const app = express()
const port = process.env.PORT || 3000
const secret = process.env.SESSION_SECRET || 'fallback_secret_key'
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    passwordHash: { type: String, required: true }
}, { timestamps: true })

const conversationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    anonCode: { type: String, required: true }, // e.g. "Student #4829"
    deletedByStudent: { type: Boolean, default: false },
    deletedByTeacher: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true })

const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    type: { type: String, enum: ['text', 'image', 'audio'], default: 'text' },
    content: { type: String, required: true }, // Text or Base64 Data URL for media
    readByTeacher: { type: Boolean, default: false },
    readByStudent: { type: Boolean, default: false }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const Conversation = mongoose.model('Conversation', conversationSchema)
const Message = mongoose.model('Message', messageSchema)

// Auth Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.sirr_session
        if (!token) throw new Error()
        const decoded = jwt.verify(token, secret)
        const user = await User.findById(decoded.sub)
        if (!user) throw new Error()
        req.user = user
        next()
    } catch {
        res.status(401).json({ error: 'Please sign in first.' })
    }
}

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(express.static(path.join(rootDir, 'dist')))

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { role, username, displayName, password, accessCode } = req.body

        if (!['student', 'teacher', 'admin'].includes(role) || !password || password.length < 6) {
            return res.status(400).json({ error: 'Invalid details or password too short (min 6 chars).' })
        }

        let finalUsername = username ? username.trim().toLowerCase() : ''
        let finalDisplayName = displayName ? displayName.trim() : ''

        if (role === 'teacher') {
            if (!process.env.TEACHER_ACCESS_CODE || accessCode !== process.env.TEACHER_ACCESS_CODE) {
                return res.status(403).json({ error: 'Invalid Teacher Access Code.' })
            }
            finalUsername = `teacher_${Date.now()}`
        } else if (role === 'admin') {
            if (!process.env.ADMIN_ACCESS_CODE || accessCode !== process.env.ADMIN_ACCESS_CODE) {
                return res.status(403).json({ error: 'Invalid Admin Access Code.' })
            }
            finalUsername = `admin_${Date.now()}`
        } else {
            if (!finalUsername) return res.status(400).json({ error: 'Username is required for students.' })
            finalDisplayName = 'Anonymous Student'
        }

        if (await User.exists({ username: finalUsername })) {
            return res.status(409).json({ error: 'Username is already taken.' })
        }

        const passwordHash = await bcrypt.hash(password, 10)
        const user = await User.create({ username: finalUsername, displayName: finalDisplayName, role, passwordHash })

        const token = jwt.sign({ sub: user._id, role: user.role }, secret, { expiresIn: '7d' })
        res.cookie('sirr_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 })
        res.json({ message: 'Account created successfully.', user: { id: user._id, role: user.role, displayName: user.displayName } })
    } catch (err) {
        res.status(500).json({ error: 'Registration failed.' })
    }
})

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { username, password } = req.body
        const user = await User.findOne({ username: username.toLowerCase().trim() })
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials.' })
        }

        const token = jwt.sign({ sub: user._id, role: user.role }, secret, { expiresIn: '7d' })
        res.cookie('sirr_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 })
        res.json({ message: 'Signed in.', user: { id: user._id, role: user.role, displayName: user.displayName } })
    } catch {
        res.status(500).json({ error: 'Sign in failed.' })
    }
})

app.post('/api/auth/signout', (req, res) => res.clearCookie('sirr_session').json({ message: 'Signed out.' }))

app.get('/api/session', auth, (req, res) => {
    res.json({ user: { id: req.user._id, role: req.user.role, displayName: req.user.displayName, username: req.user.username } })
})

// Teachers List
app.get('/api/teachers', auth, async (req, res) => {
    const teachers = await User.find({ role: 'teacher' }).select('_id displayName').sort('displayName')
    res.json({ teachers })
})

// Conversations & Chat
app.get('/api/conversations', auth, async (req, res) => {
    try {
        let query = {}
        if (req.user.role === 'student') {
            query = { studentId: req.user._id, deletedByStudent: false }
        } else if (req.user.role === 'teacher') {
            query = { teacherId: req.user._id, deletedByTeacher: false }
        } // admin gets all conversations

        const convs = await Conversation.find(query)
            .populate('teacherId', 'displayName')
            .populate('studentId', 'username')
            .sort({ lastMessageAt: -1 })
            .lean()

        const formatted = convs.map(c => ({
            id: c._id,
            title: req.user.role === 'teacher' ? c.anonCode : c.teacherId?.displayName || 'Teacher',
            studentCode: c.anonCode,
            lastMessageAt: c.lastMessageAt
        }))

        res.json({ conversations: formatted })
    } catch {
        res.status(500).json({ error: 'Could not load conversations.' })
    }
})

app.get('/api/conversations/:id/messages', auth, async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
        if (!conv) return res.status(404).json({ error: 'Chat not found.' })

        if (req.user.role === 'student' && String(conv.studentId) !== String(req.user._id)) return res.status(403).json({ error: 'Access denied.' })
        if (req.user.role === 'teacher' && String(conv.teacherId) !== String(req.user._id)) return res.status(403).json({ error: 'Access denied.' })

        const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).lean()
        res.json({ messages })
    } catch {
        res.status(500).json({ error: 'Could not fetch messages.' })
    }
})

app.post('/api/messages', auth, async (req, res) => {
    try {
        const { teacherId, conversationId, content, type = 'text' } = req.body
        let conv

        if (conversationId) {
            conv = await Conversation.findById(conversationId)
        } else if (teacherId && ['student', 'admin'].includes(req.user.role)) {
            conv = await Conversation.findOne({ studentId: req.user._id, teacherId })
            if (!conv) {
                const randCode = `Student #${Math.floor(1000 + Math.random() * 9000)}`
                conv = await Conversation.create({ studentId: req.user._id, teacherId, anonCode: randCode })
            }
        }

        if (!conv) return res.status(400).json({ error: 'Invalid message target.' })

        conv.deletedByStudent = false
        conv.deletedByTeacher = false
        conv.lastMessageAt = new Date()
        await conv.save()

        const msg = await Message.create({
            conversationId: conv._id,
            senderId: req.user._id,
            senderRole: req.user.role,
            type,
            content
        })

        res.status(201).json({ message: msg, conversationId: conv._id })
    } catch {
        res.status(500).json({ error: 'Failed to send message.' })
    }
})

app.delete('/api/conversations/:id', auth, async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
        if (!conv) return res.status(404).json({ error: 'Not found.' })

        if (req.user.role === 'student') conv.deletedByStudent = true
        if (req.user.role === 'teacher') conv.deletedByTeacher = true
        await conv.save()

        res.json({ message: 'Conversation deleted.' })
    } catch {
        res.status(500).json({ error: 'Action failed.' })
    }
})

app.get('*', (req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing.')
mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, () => console.log(`Server running on port ${port}`))
})