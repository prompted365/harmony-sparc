import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Calendar, ChevronLeft, ChevronRight, Plus, Edit, Trash2 } from 'lucide-react'
import { Content, ContentType } from '../../types'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from 'date-fns'
import apiService from '../../services/api'
import * as Dialog from '@radix-ui/react-dialog'

export const ContentCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [scheduledContent, setScheduledContent] = useState<Content[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadScheduledContent()
  }, [currentDate])

  const loadScheduledContent = async () => {
    try {
      setLoading(true)
      const startDate = startOfMonth(currentDate)
      const endDate = endOfMonth(currentDate)
      
      const contentData = await apiService.getContent({
        status: 'scheduled',
        // Add date range parameters when API supports it
      })
      
      setScheduledContent(contentData.items.filter(content => 
        content.scheduledFor && 
        new Date(content.scheduledFor) >= startDate && 
        new Date(content.scheduledFor) <= endDate
      ))
    } catch (error) {
      console.error('Error loading scheduled content:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(subMonths(currentDate, 1))
    } else {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  const getContentForDate = (date: Date) => {
    return scheduledContent.filter(content => 
      content.scheduledFor && isSameDay(new Date(content.scheduledFor), date)
    )
  }

  const getContentTypeColor = (type: ContentType) => {
    const colors = {
      'article': 'bg-blue-500',
      'social-post': 'bg-green-500',
      'newsletter': 'bg-purple-500',
      'press-release': 'bg-red-500',
      'blog-post': 'bg-yellow-500',
      'product-description': 'bg-indigo-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground">Schedule and manage your content publishing</p>
        </div>
        <Button onClick={() => setShowScheduleDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Content
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Loading calendar...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Week day headers */}
              {weekDays.map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day) => {
                const contentForDay = getContentForDate(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isToday = isSameDay(day, new Date())
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] p-2 border border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                      !isCurrentMonth ? 'text-muted-foreground bg-muted/20' : ''
                    } ${isToday ? 'bg-primary/10 border-primary' : ''} ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm ${isToday ? 'font-bold text-primary' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {contentForDay.length > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                          {contentForDay.length}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {contentForDay.slice(0, 3).map((content) => (
                        <div
                          key={content.id}
                          className={`text-xs p-1 rounded text-white truncate ${getContentTypeColor(content.type)}`}
                          title={content.title}
                        >
                          {content.title}
                        </div>
                      ))}
                      {contentForDay.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{contentForDay.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getContentForDate(selectedDate).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No content scheduled for this date</p>
                <Button variant="outline" className="mt-2" onClick={() => setShowScheduleDialog(true)}>
                  Schedule Content
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {getContentForDate(selectedDate).map((content) => (
                  <div key={content.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{content.title}</h4>
                        <Badge variant="secondary">{content.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {content.scheduledFor && format(new Date(content.scheduledFor), 'h:mm a')}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Content Dialog */}
      <Dialog.Root open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Schedule Content
            </Dialog.Title>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Content scheduling interface will be implemented here.
              </p>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                  Cancel
                </Button>
                <Button>Schedule</Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}