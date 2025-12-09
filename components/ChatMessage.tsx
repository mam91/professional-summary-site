'use client'

import TypewriterText from './TypewriterText'
import ReactMarkdown from 'react-markdown'
import employmentData from '@/employment.json'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
  speed?: number
  onTypingComplete?: () => void
}

export default function ChatMessage({ 
  role, 
  content, 
  isTyping = false,
  speed = 20,
  onTypingComplete 
}: ChatMessageProps) {
  const isUser = role === 'user'
  
  return (
    <div className={`w-full px-2 sm:px-4 py-3 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={`flex gap-2 sm:gap-3 w-full sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        {isUser ? (
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-semibold bg-[#6366f1]">
            U
          </div>
        ) : (
          <img 
            src={employmentData.avatar} 
            alt={employmentData.name}
            className="flex-shrink-0 w-10 h-10 rounded-full object-cover border-2 border-[#10b981]"
          />
        )}
        
        {/* Message Bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-[#6366f1] text-white rounded-tr-sm' 
            : 'bg-[#2a2a2a] text-gray-100 rounded-tl-sm'
        }`}>
          <TypewriterText 
            text={content} 
            speed={speed}
            onComplete={onTypingComplete}
            isTyping={isTyping}
            isUser={isUser}
          />
        </div>
      </div>
    </div>
  )
}

