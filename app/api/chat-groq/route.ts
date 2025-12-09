import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import employmentData from '@/employment.json'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Groq client only when needed
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key is not configured. Please add GROQ_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
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

    // Prepare messages for Groq
    const chatMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    // Call Groq API with Llama model
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // Fast and free!
      messages: chatMessages,
      temperature: 0.5, // Lower for more focused responses
      max_tokens: 250, // Reduced for concise answers
    })

    const responseMessage = completion.choices[0].message.content

    return NextResponse.json({ 
      message: responseMessage 
    })
  } catch (error) {
    console.error('Groq API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    )
  }
}

