import { useState, useCallback } from 'react'
import { UploadedFile } from '../types'
import apiService from '../services/api'

export interface FileUploadState {
  files: UploadedFile[]
  uploading: boolean
  progress: number
  error: string | null
}

export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    files: [],
    uploading: false,
    progress: 0,
    error: null,
  })

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    setState(prev => ({ ...prev, uploading: true, progress: 0, error: null }))

    try {
      const uploadedFile = await apiService.uploadFile(file, (progress) => {
        setState(prev => ({ ...prev, progress }))
      })

      setState(prev => ({
        ...prev,
        files: [...prev.files, uploadedFile],
        uploading: false,
        progress: 100,
      }))

      return uploadedFile
    } catch (error) {
      setState(prev => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }))
      return null
    }
  }, [])

  const uploadMultipleFiles = useCallback(async (files: File[]): Promise<UploadedFile[]> => {
    const uploadPromises = files.map(file => uploadFile(file))
    const results = await Promise.all(uploadPromises)
    return results.filter(Boolean) as UploadedFile[]
  }, [uploadFile])

  const removeFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(file => file.id !== fileId),
    }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const reset = useCallback(() => {
    setState({
      files: [],
      uploading: false,
      progress: 0,
      error: null,
    })
  }, [])

  return {
    ...state,
    uploadFile,
    uploadMultipleFiles,
    removeFile,
    clearError,
    reset,
  }
}