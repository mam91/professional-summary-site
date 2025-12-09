'use client'

import { useState, useEffect, useRef } from 'react'
import ChatMessage from '@/components/ChatMessage'
import employmentData from '@/employment.json'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
  speed?: number
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [initialTypingComplete, setInitialTypingComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevMessageCountRef = useRef(0)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  
  const MAX_STORED_MESSAGES = 50 // Safe limit for localStorage

  // Generate initial message from employment data
  // Note: Does not include 'additional_context' - that's only for the AI to reference
  const generateInitialMessage = () => {
    const data = employmentData as any
    let message = `${data.intro}\n\n`
    message += `# ${data.name}\n## ${data.title}\n\n${data.summary}\n\n`
    
    message += `## Professional Experience\n\n`
    data.employment.forEach((job: any) => {
      message += `### ${job.role} at ${job.company}\n`
      message += `*${job.duration}* | ${job.location}\n\n`
      message += `**Key Responsibilities:**\n`
      job.responsibilities.forEach((resp: string) => {
        message += `- ${resp}\n`
      })
      message += `\n**Notable Achievements:**\n`
      job.achievements.forEach((ach: string) => {
        message += `- ${ach}\n`
      })
      message += `\n**Technologies:** ${job.technologies.join(', ')}\n\n`
    })

    message += `## Technical Skills\n`
    message += `- **Languages:** ${data.skills.languages.join(', ')}\n`
    message += `- **Frontend:** ${data.skills.frontend.join(', ')}\n`
    message += `- **Backend:** ${data.skills.backend.join(', ')}\n`
    message += `- **Databases:** ${data.skills.databases.join(', ')}\n`
    message += `- **Cloud & DevOps:** ${data.skills.cloud.join(', ')}\n`
    message += `- **Tools:** ${data.skills.tools.join(', ')}\n`
    message += `- **Other:** ${data.skills.other.join(', ')}\n\n`

    message += `## Education\n`
    data.education.forEach((edu: any) => {
      message += `**${edu.degree}**\n`
      message += `${edu.school} | ${edu.year}\n\n`
    })
    
    message += `---\n\n*Feel free to ask me any questions about my professional experience!*`
    
    return message
  }

  // Load messages from session storage or generate initial message
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem('chatMessages')
      const savedInitialComplete = sessionStorage.getItem('initialTypingComplete')
      
      if (savedMessages) {
        // Restore previous session
        const parsedMessages = JSON.parse(savedMessages)
        // Mark all restored messages as not typing (instant load)
        const restoredMessages = parsedMessages.map((msg: Message) => ({
          ...msg,
          isTyping: false
        }))
        setMessages(restoredMessages)
        setInitialTypingComplete(savedInitialComplete === 'true')
        setIsRestoringSession(false)
      } else {
        // First time visit - generate initial message
        const initialMessage = generateInitialMessage()
        setMessages([
          {
            role: 'assistant',
            content: initialMessage,
            isTyping: true,
            speed: 1 
          }
        ])
        setIsRestoringSession(false)
      }
    } catch (error) {
      console.error('Error loading session:', error)
      // Fallback to initial message
      const initialMessage = generateInitialMessage()
      setMessages([
        {
          role: 'assistant',
          content: initialMessage,
          isTyping: true,
          speed: 1 
        }
      ])
      setIsRestoringSession(false)
    }
  }, [])
  
  // Save messages to session storage whenever they change
  useEffect(() => {
    if (!isRestoringSession && messages.length > 0) {
      try {
        // Keep only the last MAX_STORED_MESSAGES
        const messagesToStore = messages.slice(-MAX_STORED_MESSAGES)
        sessionStorage.setItem('chatMessages', JSON.stringify(messagesToStore))
        sessionStorage.setItem('initialTypingComplete', String(initialTypingComplete))
      } catch (error) {
        console.error('Error saving session:', error)
      }
    }
  }, [messages, initialTypingComplete, isRestoringSession])

  // Auto-scroll to bottom only when new messages are added
  useEffect(() => {
    // Only scroll if the number of messages increased (new message added)
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCountRef.current = messages.length
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !initialTypingComplete) return

    const userMessage = input.trim()
    setInput('')
    
    // Add user message
    const newMessages = [
      ...messages.map(m => ({ ...m, isTyping: false })),
      { role: 'user' as const, content: userMessage }
    ]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      // Call API (using Groq - free!)
      const response = await fetch('/api/chat-groq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()
      
      // Add assistant response with typing animation
      setMessages([
        ...newMessages,
        { 
          role: 'assistant', 
          content: data.message,
          isTyping: true
        }
      ])
    } catch (error) {
      console.error('Error:', error)
      setMessages([
        ...newMessages,
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.',
          isTyping: false
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTypingComplete = (index: number) => {
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, isTyping: false } : msg
    ))
    // Mark initial typing as complete when the first message is done
    if (!initialTypingComplete && index === 0) {
      setInitialTypingComplete(true)
      inputRef.current?.focus()
    }
  }
  
  // Clear session storage (optional - can be called from UI if needed)
  const clearSession = () => {
    sessionStorage.removeItem('chatMessages')
    sessionStorage.removeItem('initialTypingComplete')
    window.location.reload()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#161616] pb-32 sm:pb-0">
        <div className="w-full sm:max-w-4xl sm:mx-auto">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              role={message.role}
              content={message.content}
              isTyping={message.isTyping}
              speed={message.speed}
              onTypingComplete={() => handleTypingComplete(index)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed on mobile, normal on desktop */}
      <div className="fixed sm:relative bottom-0 left-0 right-0 bg-[#161616] border-t border-gray-900 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="w-full sm:max-w-3xl sm:mx-auto">
          <div className="relative flex items-center bg-[#1f1f1f] rounded-lg shadow-lg border border-gray-800">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !initialTypingComplete 
                  ? "Please wait for the introduction to complete..." 
                  : "Ask me about my professional experience..."
              }
              disabled={!initialTypingComplete || isLoading}
              className="flex-1 bg-transparent text-white px-4 py-3 focus:outline-none resize-none max-h-32"
              rows={1}
              style={{
                minHeight: '52px',
                maxHeight: '200px',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !initialTypingComplete}
              className="mr-3 p-2 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M7 11L12 6L17 11M12 18V7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            {/* Contact Icons */}
            <div className="flex gap-3">
          <a 
            href={`tel:${employmentData.contact.phone}`}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Phone"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </a>
          <a 
            href={`mailto:${employmentData.contact.email}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Email"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </a>
          <a 
            href={employmentData.contact.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a 
            href="/resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="View Resume"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </a>
            </div>
            <p className="text-xs text-gray-500 text-right">
              Press Enter to send
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

