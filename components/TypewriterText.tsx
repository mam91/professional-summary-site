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
          p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed text-gray-100">{children}</p>,
          ul: ({children}) => <ul className="list-disc ml-5 mb-3 space-y-1.5 text-gray-200">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal ml-5 mb-3 space-y-1.5 text-gray-200">{children}</ol>,
          li: ({children}) => <li className="leading-relaxed pl-1">{children}</li>,
          h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-3 text-white border-b border-gray-700 pb-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-bold mb-3 mt-3 text-white">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-semibold mb-2 mt-2 text-emerald-400">{children}</h3>,
          strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({children}) => <em className="text-gray-400 not-italic">{children}</em>,
          code: ({children}) => <code className={`${isUser ? 'bg-indigo-700' : 'bg-emerald-900/30'} text-emerald-300 px-2 py-0.5 rounded text-sm font-mono`}>{children}</code>,
          hr: () => <hr className="my-4 border-gray-700" />,
          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
          blockquote: ({children}) => <blockquote className="border-l-4 border-emerald-500 pl-4 italic text-gray-300 my-2">{children}</blockquote>,
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

