import { useState, useEffect, useRef } from 'react'
import './App.css'
import FlipDigit from './flipDigit'

const defaultDurations = {
  pomodoro: 25,
  short: 5,
  long: 15,
}
const sessionOptions = {
  pomodoro: defaultDurations.pomodoro * 60,
  short: defaultDurations.short * 60,
  long: defaultDurations.long * 60,
}
const sessionOrder = ['pomodoro', 'short', 'pomodoro', 'short', 'pomodoro', 'short', 'pomodoro', 'long']
const POMODOROS_PER_CYCLE = 4

function App() {
  const [session, setSession] = useState('pomodoro')
  const [durations, setDurations] = useState(() => {
    const saved = localStorage.getItem('durations')
    return saved ? JSON.parse(saved) : { ...defaultDurations }
  })
  const [timeLeft, setTimeLeft] = useState(durations['pomodoro'] * 60)
  const [isRunning, setIsRunning] = useState(false)
  const alarmRef = useRef(null)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [cycleIndex, setCycleIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [tempDurations, setTempDurations] = useState({ ...durations })
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled')
    return saved === null ? true : saved === 'true'
  })
  const [notifEnabled, setNotifEnabled] = useState(() => {
    const saved = localStorage.getItem('notifEnabled')
    return saved === null ? false : saved === 'true'
  })

  // Stats: Pomodoros completed today/this week
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('pomodoroStats')
    if (saved) return JSON.parse(saved)
    const today = new Date().toISOString().slice(0, 10)
    return { today, todayCount: 0, week: getWeekString(), weekCount: 0 }
  })

  // To-Do List State
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('pomodoroTodos')
    return saved ? JSON.parse(saved) : []
  })
  const [newTodo, setNewTodo] = useState('')

  // Pulse animation state for Pomodoro completion
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (timeLeft === 0 && session === 'pomodoro') {
      setPulse(true)
      setTimeout(() => setPulse(false), 800)
    }
  }, [timeLeft, session])

  // Helper to get current week string (YYYY-WW)
  function getWeekString() {
    const now = new Date()
    const year = now.getFullYear()
    const oneJan = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil((((now - oneJan) / 86400000) + oneJan.getDay() + 1) / 7)
    return `${year}-W${week}`
  }

  // Update stats when a Pomodoro is completed
  useEffect(() => {
    // Only increment if a Pomodoro just finished
    if (pomodoroCount > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const week = getWeekString()
      setStats(prev => {
        let newStats = { ...prev }
        // Reset daily/weekly if date/week changed
        if (prev.today !== today) {
          newStats.today = today
          newStats.todayCount = 0
        }
        if (prev.week !== week) {
          newStats.week = week
          newStats.weekCount = 0
        }
        newStats.todayCount += 1
        newStats.weekCount += 1
        localStorage.setItem('pomodoroStats', JSON.stringify(newStats))
        return newStats
      })
    }
    // eslint-disable-next-line
  }, [pomodoroCount])

  // On mount, reset stats if day/week changed
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const week = getWeekString()
    setStats(prev => {
      let newStats = { ...prev }
      if (prev.today !== today) {
        newStats.today = today
        newStats.todayCount = 0
      }
      if (prev.week !== week) {
        newStats.week = week
        newStats.weekCount = 0
      }
      localStorage.setItem('pomodoroStats', JSON.stringify(newStats))
      return newStats
    })
    // eslint-disable-next-line
  }, [])

  // Load from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('session')
    const savedTime = localStorage.getItem('timeLeft')
    const savedDurations = localStorage.getItem('durations')
    if (savedSession) setSession(savedSession)
    if (savedTime) setTimeLeft(Number(savedTime))
    if (savedDurations) setDurations(JSON.parse(savedDurations))
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('session', session)
    localStorage.setItem('timeLeft', timeLeft)
    localStorage.setItem('durations', JSON.stringify(durations))
  }, [session, timeLeft, durations])

  // Save sound/notification preferences
  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled)
    localStorage.setItem('notifEnabled', notifEnabled)
  }, [soundEnabled, notifEnabled])

  // Request notification permission if enabled
  useEffect(() => {
    if (notifEnabled && Notification && Notification.permission !== 'granted') {
      Notification.requestPermission()
    }
  }, [notifEnabled])

  // Timer logic with auto-switch (update alarm/notification logic)
  useEffect(() => {
    let timer
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    } else if (timeLeft === 0) {
      clearInterval(timer)
      setIsRunning(false)
      if (soundEnabled) alarmRef.current?.play()
      if (notifEnabled && Notification && Notification.permission === 'granted') {
        const nextIndex = cycleIndex + 1 >= sessionOrder.length ? 0 : cycleIndex + 1
        const nextSession = sessionOrder[nextIndex]
        const sessionNames = { pomodoro: 'Pomodoro', short: 'Short Break', long: 'Long Break' }
        new Notification('Pomodoro Timer', {
          body: `Time for ${sessionNames[nextSession]}!`,
        })
      }
      // Auto-switch session
      setTimeout(() => {
        let nextIndex = cycleIndex + 1
        if (nextIndex >= sessionOrder.length) nextIndex = 0
        setCycleIndex(nextIndex)
        const nextSession = sessionOrder[nextIndex]
        setSession(nextSession)
        setTimeLeft(durations[nextSession] * 60)
        setIsRunning(false)
        if (nextSession === 'pomodoro') {
          setPomodoroCount((c) => c + 1)
        }
        // Reset pomodoro count at the start of a new cycle
        if (nextIndex === 0) setPomodoroCount(0)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isRunning, timeLeft, cycleIndex, durations, soundEnabled, notifEnabled])

  // Reset time and update cycleIndex when switching sessions manually
  useEffect(() => {
    setTimeLeft(durations[session] * 60)
    setIsRunning(false)
    // Update cycleIndex to match manual session change
    const idx = sessionOrder.findIndex((s, i) => s === session && (i >= cycleIndex || session === 'long'))
    if (idx !== -1) setCycleIndex(idx)
  }, [session, durations])

  // Apply theme to root
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const formatTime = () => {
    const m = Math.floor(timeLeft / 60)
    const s = timeLeft % 60
    return {
      minutes: m.toString().padStart(2, '0'),
      seconds: s.toString().padStart(2, '0'),
    }
  }

  const time = formatTime()

  // Progress calculation
  const sessionTotal = durations[session] * 60
  const progress = 1 - timeLeft / sessionTotal

  // Small circular progress SVG component
  function SmallCircularProgress({ progress, size = 40, stroke = 4 }) {
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - progress)
    return (
      <svg width={size} height={size} className="block" style={{ display: 'block' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme === 'dark' ? '#222' : '#eee'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme === 'dark' ? '#22d3ee' : '#0ea5e9'}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
    )
  }

  // Settings modal handlers
  const openSettings = () => {
    setTempDurations({ ...durations })
    setShowSettings(true)
  }
  const closeSettings = () => setShowSettings(false)
  const handleDurationChange = (key, value) => {
    setTempDurations((prev) => ({ ...prev, [key]: value }))
  }
  const saveDurations = () => {
    setDurations({ ...tempDurations })
    setTimeLeft(tempDurations[session] * 60)
    setShowSettings(false)
  }

  // Theme toggle handler
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // Theme-based classes
  const bgMain = theme === 'dark' ? 'bg-neutral-900' : 'bg-neutral-100'
  const cardBg = theme === 'dark' ? 'bg-neutral-800' : 'bg-white'
  const textMain = theme === 'dark' ? 'text-white' : 'text-neutral-900'
  const textSubtle = theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'
  const borderInput = theme === 'dark' ? 'border-neutral-700' : 'border-neutral-300'
  const inputBg = theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'

  // Save todos to localStorage
  useEffect(() => {
    localStorage.setItem('pomodoroTodos', JSON.stringify(todos))
  }, [todos])

  // Add new todo
  const addTodo = (e) => {
    e.preventDefault()
    if (newTodo.trim()) {
      setTodos([...todos, { text: newTodo.trim(), done: false, id: Date.now() }])
      setNewTodo('')
    }
  }
  // Toggle done
  const toggleTodo = (id) => {
    setTodos(todos.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo))
  }
  // Delete todo
  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className={`min-h-screen ${bgMain} flex flex-col items-center justify-center px-2`}>
      <div className={`${cardBg} rounded-2xl shadow-2xl p-4 sm:p-8 md:p-10 flex flex-col items-center w-full max-w-md space-y-6 sm:space-y-8 relative`}>
        {/* Small Circular Progress in top right */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
          <SmallCircularProgress progress={progress} size={32} stroke={3} />
        </div>
        <div className="flex w-full justify-between items-center mb-1 sm:mb-2 flex-wrap gap-2">
          <h1 className={`text-2xl sm:text-3xl font-semibold tracking-tight ${textMain}`}>Pomodoro Timer</h1>
          <div className="flex gap-2 items-center">
            <button onClick={toggleTheme} className={`p-2 rounded-full ${theme === 'dark' ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-neutral-200 hover:bg-neutral-300'} transition`} title="Toggle dark/light mode">
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m8.485-8.485h-1.5m-15 0H3m15.364-6.364l-1.06 1.06m-10.607 10.607l-1.06 1.06m12.727 0l-1.06-1.06m-10.607-10.607l-1.06-1.06M12 7.5A4.5 4.5 0 1012 16.5a4.5 4.5 0 000-9z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0112 21.75c-5.385 0-9.75-4.365-9.75-9.75 0-4.006 2.362-7.464 5.833-9.03a.75.75 0 01.977.977A7.501 7.501 0 0019.5 12c0 1.61-.508 3.104-1.385 4.335a.75.75 0 01-.977.977z" />
                </svg>
              )}
            </button>
            <button onClick={openSettings} className={`ml-2 p-2 rounded-full ${theme === 'dark' ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-neutral-200 hover:bg-neutral-300'} transition`} title="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 sm:w-6 sm:h-6 ${theme === 'dark' ? 'text-white' : 'text-neutral-700'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.149-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Session Counter */}
        <div className={`mb-1 sm:mb-2 ${textSubtle} text-xs sm:text-sm`}>Pomodoros this cycle: <span className={`${textMain} font-bold`}>{pomodoroCount} / {POMODOROS_PER_CYCLE}</span></div>
        {/* Pomodoro Stats */}
        <div className={`mb-1 sm:mb-2 ${textSubtle} text-xs sm:text-sm`}>Today: <span className={`${textMain} font-bold`}>{stats.todayCount}</span> &nbsp;|&nbsp; This week: <span className={`${textMain} font-bold`}>{stats.weekCount}</span></div>
        {/* Session Buttons */}
        <div className="flex gap-2 sm:gap-4 mb-2 w-full justify-center overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-neutral-400 scrollbar-track-transparent pb-1">
          {Object.keys(sessionOptions).map((key) => (
            <button
              key={key}
              onClick={() => setSession(key)}
              className={`px-3 sm:px-5 py-2 rounded-lg font-medium transition text-xs sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-white/40
                ${session === key
                  ? (theme === 'dark'
                      ? 'bg-white text-neutral-900 shadow-md border-2 border-white'
                      : 'bg-white text-neutral-900 shadow-md border-2 border-neutral-300')
                  : (theme === 'dark'
                      ? 'bg-neutral-900 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-transparent'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 border border-neutral-200')}`}
            >
              {key === 'pomodoro' ? 'Pomodoro' : key === 'short' ? 'Short Break' : 'Long Break'}
            </button>
          ))}
        </div>
        {/* Flip Clock Timer Display */}
        <div className={`flex gap-1 sm:gap-4 mb-2 scale-90 sm:scale-100 transition-transform duration-300 ${pulse ? 'animate-pulse' : ''}`}
             aria-label="Timer display">
          <FlipDigit value={time.minutes[0]} />
          <FlipDigit value={time.minutes[1]} />
          <div className={`text-5xl sm:text-8xl font-mono select-none ${textMain}`}>:</div>
          <FlipDigit value={time.seconds[0]} />
          <FlipDigit value={time.seconds[1]} />
        </div>
        {/* Controls */}
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full justify-center">
          <button
            onClick={() => setIsRunning(true)}
            disabled={isRunning}
            className={`px-5 sm:px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-label="Start timer"
          >
            Start
          </button>
          <button
            onClick={() => setIsRunning(false)}
            disabled={!isRunning}
            className={`px-5 sm:px-8 py-2 border border-yellow-500 text-yellow-500 rounded-lg font-semibold hover:bg-yellow-500 hover:text-neutral-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-label="Pause timer"
          >
            Pause
          </button>
          <button
            onClick={() => {
              setIsRunning(false)
              setTimeLeft(durations[session] * 60)
            }}
            className={`px-5 sm:px-8 py-2 border border-white text-white rounded-lg font-semibold hover:bg-white hover:text-neutral-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-95`}
            aria-label="Reset timer"
          >
            Reset
          </button>
        </div>
        {/* Divider */}
        <div className="w-full border-t border-dashed border-neutral-400 my-4 opacity-40" aria-hidden="true"></div>
        {/* To-Do List */}
        <div className="w-full max-w-sm">
          <form onSubmit={addTodo} className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              placeholder="Add a task..."
              className={`flex-1 rounded px-3 py-2 ${inputBg} ${textMain} border ${borderInput} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 text-sm transition-shadow duration-200`}
              aria-label="Add a new task"
            />
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm active:scale-95" aria-label="Add task">Add</button>
          </form>
          <ul className="space-y-1">
            {todos.length === 0 && (
              <li className={`${textSubtle} text-xs`}>No tasks yet.</li>
            )}
            {todos.map(todo => (
              <li key={todo.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-6 h-6 sm:w-5 sm:h-5 rounded border flex items-center justify-center transition-all duration-200 ${todo.done ? 'bg-green-500 border-green-500 scale-110' : borderInput}`}
                  aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
                >
                  {todo.done && (
                    <svg className="w-4 h-4 text-white transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${textMain} ${todo.done ? 'line-through opacity-60' : ''}`}>{todo.text}</span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-xs text-red-400 hover:text-red-600 px-1 focus-visible:opacity-100"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${cardBg} rounded-xl p-8 shadow-2xl w-80 flex flex-col gap-6`}>
              <h2 className={`text-xl font-semibold mb-2 ${textMain}`}>Timer Settings</h2>
              <div className="flex flex-col gap-4">
                {['pomodoro', 'short', 'long'].map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className={`${textSubtle} text-sm font-medium capitalize`}>{key === 'pomodoro' ? 'Pomodoro' : key === 'short' ? 'Short Break' : 'Long Break'} Duration (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={tempDurations[key]}
                      onChange={e => handleDurationChange(key, Math.max(1, Math.min(60, Number(e.target.value))))}
                      className={`rounded px-3 py-2 ${inputBg} ${textMain} border ${borderInput} focus:outline-none focus:ring-2 focus:ring-white/30`}
                    />
                  </div>
                ))}
                {/* Sound and Notification Toggles */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="sound-toggle"
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => setSoundEnabled(e.target.checked)}
                    className="accent-green-600 w-4 h-4"
                  />
                  <label htmlFor="sound-toggle" className={`${textSubtle} text-sm`}>Alarm Sound</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="notif-toggle"
                    type="checkbox"
                    checked={notifEnabled}
                    onChange={e => setNotifEnabled(e.target.checked)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <label htmlFor="notif-toggle" className={`${textSubtle} text-sm`}>Browser Notification</label>
                </div>
              </div>
              <div className="flex gap-4 justify-end mt-4">
                <button onClick={closeSettings} className={`px-4 py-2 rounded ${theme === 'dark' ? 'bg-neutral-700 hover:bg-neutral-600 text-white' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900'} transition`}>Cancel</button>
                <button onClick={saveDurations} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition">Save</button>
              </div>
            </div>
          </div>
        )}
        {/* 🔔 Audio */}
        <audio ref={alarmRef} src="/public/alarm.mp3" preload="auto" />
      </div>
    </div>
  )
}

export default App
