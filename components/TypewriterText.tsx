'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
  isTyping?: boolean
  isUser?: boolean
}

export default function TypewriterText({ 
  text, 
  speed = 20, 
  onComplete,
  isTyping = false,
  isUser = false
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (isTyping && currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    } else if (onComplete && currentIndex === text.length && text.length > 0 && isTyping) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete, isTyping])

  // If not typing, show full text immediately
  const contentToShow = isTyping ? displayedText : text

  return (
    <div className="relative">
      <ReactMarkdown 
        className={`prose ${isUser ? 'prose-invert' : 'prose-invert'} prose-sm max-w-none`}
        components={{
          p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({children}) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
          li: ({children}) => <li className="leading-relaxed">{children}</li>,
          h1: ({children}) => <h1 className="text-xl font-bold mb-3 mt-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-base font-bold mb-2 mt-1">{children}</h3>,
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          code: ({children}) => <code className={`${isUser ? 'bg-indigo-700' : 'bg-black/40'} px-1.5 py-0.5 rounded text-sm`}>{children}</code>,
          hr: () => <hr className="my-3 border-gray-600" />,
        }}
      >
        {contentToShow}
      </ReactMarkdown>
      {isTyping && currentIndex < text.length && (
        <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}

