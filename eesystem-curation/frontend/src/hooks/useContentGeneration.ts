import { useState, useCallback } from 'react'
import { ContentGeneration, GenerationParameters } from '../types'
import apiService from '../services/api'
import { useWebSocket } from '../contexts/WebSocketContext'

export interface ContentGenerationState {
  generations: ContentGeneration[]
  loading: boolean
  error: string | null
}

export const useContentGeneration = () => {
  const [state, setState] = useState<ContentGenerationState>({
    generations: [],
    loading: false,
    error: null,
  })

  const { sendMessage } = useWebSocket()

  const generateContent = useCallback(async (params: {
    type: string
    prompt: string
    brandId: string
    parameters: GenerationParameters
  }): Promise<ContentGeneration | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const generation = await apiService.generateContent(params)
      
      setState(prev => ({
        ...prev,
        generations: [...prev.generations, generation],
        loading: false,
      }))

      // Send WebSocket message to track generation
      sendMessage('start-generation', { generationId: generation.id })

      return generation
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      }))
      return null
    }
  }, [sendMessage])

  const updateGeneration = useCallback((generation: ContentGeneration) => {
    setState(prev => ({
      ...prev,
      generations: prev.generations.map(g => 
        g.id === generation.id ? generation : g
      ),
    }))
  }, [])

  const removeGeneration = useCallback((generationId: string) => {
    setState(prev => ({
      ...prev,
      generations: prev.generations.filter(g => g.id !== generationId),
    }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const getGenerationById = useCallback((id: string) => {
    return state.generations.find(g => g.id === id)
  }, [state.generations])

  const getGenerationsByStatus = useCallback((status: ContentGeneration['status']) => {
    return state.generations.filter(g => g.status === status)
  }, [state.generations])

  return {
    ...state,
    generateContent,
    updateGeneration,
    removeGeneration,
    clearError,
    getGenerationById,
    getGenerationsByStatus,
  }
}