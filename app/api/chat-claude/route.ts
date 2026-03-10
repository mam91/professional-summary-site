import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import employmentData from '@/employment.json'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Simple in-memory rate limiting (resets on server restart)
// For production, consider using Redis or a database
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS_PER_WINDOW = 20 // 20 requests per hour per IP

// Allowed origins for CORS and referrer checking
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://michaelalanmiller.dev',
  'https://www.michaelalanmiller.dev',
]

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < cutoff) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!record || now > record.resetTime) {
    // Create new rate limit window
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    })
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    }
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    }
  }

  record.count++
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - record.count,
    resetTime: record.resetTime,
  }
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = (isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0]) || ALLOWED_ORIGINS[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  
  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 })
  }

  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  
  // 1. Check CORS / Referrer
  if (!isOriginAllowed(origin) && !isOriginAllowed(referer)) {
    return NextResponse.json(
      { error: 'Unauthorized origin' },
      { 
        status: 403,
        headers: getCorsHeaders(origin),
      }
    )
  }

  // 2. Check rate limit
  const ip = (req as any).ip ?? req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'anonymous'
  const rateLimit = checkRateLimit(ip)

  if (!rateLimit.allowed) {
    const waitMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / 60000)
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          ...getCorsHeaders(origin),
          'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  try {
    // Initialize Anthropic client only when needed
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const { messages } = await req.json()

    // Create a comprehensive system prompt with employment data
    const systemPrompt = `You are ${employmentData.name}, responding in first person.

YOUR ROLE AND CONSTRAINTS:
- Respond as "I/me" - you ARE ${employmentData.name}
- PRIORITIZE information from the data provided below when available
- You can use reasoning and general knowledge to answer questions naturally and helpfully
- For professional questions, stick closely to the provided employment data
- For other topics, you can provide reasonable, thoughtful responses that align with the persona
- Be professional, CONCISE, and personable - keep responses brief and to the point
- Use bullet points when listing multiple items
- Avoid lengthy explanations - provide clear, succinct answers

YOUR BACKGROUND INFORMATION (Primary source):
${JSON.stringify(employmentData, null, 2)}

GUIDELINES:
- Questions about work experience/skills → Use employment data as your source of truth
- Questions about hobbies/preferences → Use additional_context if available, otherwise provide reasonable responses
- General conversation → Be helpful and personable, stay in character as Michael
- Technical questions → Draw on the technical background shown in your employment history

Remember: You ARE Michael Miller. Speak in first person. Be helpful and conversational while staying true to your professional background.`

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content
    }))

    // Create a streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call Anthropic API with streaming
          const streamResponse = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001', // Fast and cost-effective
            max_tokens: 800, // Increased to allow complete responses
            temperature: 0.7, // Balanced creativity
            system: systemPrompt,
            messages: anthropicMessages,
            stream: true,
          })

          // Stream the response chunks
          for await (const chunk of streamResponse) {
            if (chunk.type === 'content_block_delta' && 
                chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              const data = `data: ${JSON.stringify({ text })}\n\n`
              controller.enqueue(encoder.encode(data))
            }
            
            // Handle other event types
            if (chunk.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            }
          }
          
          controller.close()
        } catch (streamError: any) {
          console.error('Streaming error:', streamError)
          // Send error message to client
          const errorMsg = `data: ${JSON.stringify({ 
            error: true, 
            text: 'Stream error occurred. Please try again.' 
          })}\n\n`
          controller.enqueue(encoder.encode(errorMsg))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      },
    })
  } catch (error: any) {
    console.error('Anthropic API error:', error)
    
    // Handle rate limiting specifically
    if (error?.status === 429 || error?.message?.includes('rate limit')) {
      // Try to extract retry time from error response
      let retryMessage = "I've hit my rate limit. Please wait a moment and try again."
      
      const retryAfter = error?.headers?.['retry-after']
      const rateLimitReset = error?.headers?.['x-ratelimit-reset']
      
      if (retryAfter) {
        const seconds = parseInt(retryAfter)
        if (!isNaN(seconds)) {
          if (seconds < 60) {
            retryMessage = `I've hit my rate limit. Please wait about ${seconds} seconds and try again.`
          } else {
            const minutes = Math.ceil(seconds / 60)
            retryMessage = `I've hit my rate limit. Please wait about ${minutes} minute${minutes > 1 ? 's' : ''} and try again.`
          }
        }
      } else if (rateLimitReset) {
        const resetTime = parseInt(rateLimitReset)
        if (!isNaN(resetTime)) {
          const now = Math.floor(Date.now() / 1000)
          const waitSeconds = Math.max(0, resetTime - now)
          
          if (waitSeconds < 60) {
            retryMessage = `I've hit my rate limit. Please wait about ${waitSeconds} seconds and try again.`
          } else {
            const minutes = Math.ceil(waitSeconds / 60)
            retryMessage = `I've hit my rate limit. Please wait about ${minutes} minute${minutes > 1 ? 's' : ''} and try again.`
          }
        }
      }
      
      return NextResponse.json(
        { message: retryMessage },
        { 
          status: 200,
          headers: getCorsHeaders(origin),
        }
      )
    }
    
    // Generic error handling
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { 
        status: 500,
        headers: getCorsHeaders(origin),
      }
    )
  }
}

