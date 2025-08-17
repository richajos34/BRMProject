"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {AgreementDrawer} from "@/components/AgreementDrawer";

interface CalendarEvent {
  id: string;
  title: string;
  vendor: string;
  date: string;
  type: 'notice' | 'renewal' | 'termination';
  description: string;
}

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Notice Deadline',
    vendor: 'Acme Software Solutions',
    date: '2025-08-23',
    type: 'notice',
    description: 'Final notice deadline for software licensing agreement'
  },
  {
    id: '2',
    title: 'Contract Renewal',
    vendor: 'CloudTech Services',
    date: '2025-09-15',
    type: 'renewal',
    description: 'Annual renewal for cloud infrastructure services'
  },
  {
    id: '3',
    title: 'Notice Deadline',
    vendor: 'DataFlow Systems',
    date: '2025-10-01',
    type: 'notice',
    description: 'Notice deadline for data processing agreement'
  },
  {
    id: '4',
    title: 'Contract Renewal',
    vendor: 'SecureNet Inc.',
    date: '2025-10-30',
    type: 'renewal',
    description: 'Cybersecurity services contract renewal'
  },
  {
    id: '5',
    title: 'Contract Termination',
    vendor: 'TechFlow Solutions',
    date: '2025-11-15',
    type: 'termination',
    description: 'End of contract term for consulting services'
  }
];

const getEventColor = (type: string) => {
  switch (type) {
    case 'notice':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'renewal':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'termination':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Generate calendar days
  const days = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return mockEvents.filter(event => event.date === dateStr);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  return (
  
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2">Calendar</h1>
          <p className="text-muted-foreground">
            View all contract deadlines and renewals
          </p>
        </div>
        <Button variant="outline">
          <CalendarIcon size={16} className="mr-2" />
          Today
        </Button>
      </div>

      {/* Calendar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {monthNames[month]} {year}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft size={18} />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-3 text-center text-sm text-muted-foreground font-medium">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((day, index) => (
              <div
                key={index}
                className={cn(
                  "min-h-[120px] border border-border p-2 bg-background",
                  day && "hover:bg-muted/50 cursor-pointer"
                )}
              >
                {day && (
                  <>
                    <div className={cn(
                      "text-sm mb-2 font-medium",
                      isToday(day) && "text-primary"
                    )}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {getEventsForDate(day).map((event) => (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={cn(
                            "text-xs p-1 rounded border cursor-pointer hover:shadow-sm transition-shadow",
                            getEventColor(event.type)
                          )}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="truncate opacity-75">{event.vendor}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-sm">Notice Deadline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-sm">Renewal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-500"></div>
              <span className="text-sm">Term End</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreement Drawer */}
      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}