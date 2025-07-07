import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ScheduleData } from '../../types'

interface ContentChartProps {
  data: ScheduleData[]
}

export const ContentChart: React.FC<ContentChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
            formatter={(value) => [value, 'Content Count']}
          />
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke="#43FAFF" 
            strokeWidth={2}
            dot={{ fill: '#43FAFF' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}