import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import employmentData from '@/employment.json'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
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
            model: 'claude-3-5-haiku-20241022', // Fast and cost-effective
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
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
        { status: 200 }
      )
    }
    
    // Generic error handling
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    )
  }
}

