import React, { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useFileUpload } from '../../hooks/useFileUpload'
import { formatFileSize } from '../../lib/utils'

export const FileUpload: React.FC = () => {
  const { files, uploading, progress, error, uploadFile, removeFile, clearError } = useFileUpload()
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      for (const file of Array.from(selectedFiles)) {
        await uploadFile(file)
      }
    }
  }, [uploadFile])

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles) {
      for (const file of Array.from(droppedFiles)) {
        await uploadFile(file)
      }
    }
  }, [uploadFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
  }, [])

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.includes('pdf')) return '📄'
    if (type.includes('word')) return '📝'
    if (type.includes('text')) return '📄'
    if (type.includes('csv')) return '📊'
    if (type.includes('json')) return '📋'
    return '📄'
  }

  const getFileStatusColor = (processed: boolean) => {
    return processed ? 'success' : 'secondary'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Documents</h1>
        <p className="text-muted-foreground">
          Upload documents to extract content and generate new materials
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Drag & Drop Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input 
              id="file-input"
              type="file" 
              multiple 
              onChange={handleFileSelect}
              style={{ display: 'none' }} 
              accept=".txt,.pdf,.doc,.docx,.md,.json,.csv,.png,.jpg,.jpeg,.gif,.webp"
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {dragActive ? 'Drop files here' : 'Drag files here or click to browse'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Supports: PDF, DOC, DOCX, TXT, MD, CSV, JSON, Images
            </p>
            <p className="text-sm text-muted-foreground">
              Maximum file size: 50MB
            </p>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-destructive">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Upload Error</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearError}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-destructive mt-1">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <File className="h-5 w-5 mr-2" />
              Uploaded Files ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getFileIcon(file.type)}</span>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)} • {file.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getFileStatusColor(!!file.processedAt)}>
                      {file.processedAt ? 'Processed' : 'Processing'}
                    </Badge>
                    {file.processedAt && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {files.some(f => !f.processedAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Content Extraction</span>
                <Badge variant="info">In Progress</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Metadata Analysis</span>
                <Badge variant="secondary">Pending</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">AI Processing</span>
                <Badge variant="secondary">Pending</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}