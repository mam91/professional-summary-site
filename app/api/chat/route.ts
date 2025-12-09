import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import employmentData from '@/employment.json'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    // Initialize OpenAI client only when needed
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { messages } = await req.json()

    // Create a comprehensive system prompt with employment data
    const systemPrompt = `You are an AI assistant for ${employmentData.name}'s professional portfolio. 

YOUR ROLE AND CONSTRAINTS:
- You can ONLY answer questions about ${employmentData.name}'s professional background, work experience, skills, and career
- If asked about anything unrelated (weather, sports, general knowledge, other topics), politely decline and redirect to career topics
- Be professional, CONCISE, and direct - keep responses brief and to the point
- Use bullet points when listing multiple items
- Avoid lengthy explanations - provide clear, succinct answers
- Use the employment data provided below to answer questions accurately

PROFESSIONAL INFORMATION:
${JSON.stringify(employmentData, null, 2)}

EXAMPLE RESPONSES FOR OFF-TOPIC QUESTIONS:
- "I'm here specifically to discuss ${employmentData.name}'s professional experience. What would you like to know about their work?"
- "I can only answer questions about ${employmentData.name}'s career. What interests you about their experience?"

Remember: Stay focused on the professional information provided. Be helpful, brief, and maintain boundaries.`

    // Prepare messages for OpenAI
    const chatMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: chatMessages,
      temperature: 0.5, // Lower for more focused responses
      max_tokens: 250, // Reduced for concise answers
    })

    const responseMessage = completion.choices[0].message.content

    return NextResponse.json({ 
      message: responseMessage 
    })
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    )
  }
}

