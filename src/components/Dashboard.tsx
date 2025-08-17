import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';

interface Deadline {
  id: string;
  vendor: string;
  type: 'notice' | 'renewal' | 'termination';
  date: string;
  daysUntil: number;
  status: 'urgent' | 'upcoming' | 'normal';
}

interface Vendor {
  id: string;
  name: string;
  activeContracts: number;
  totalValue: string;
  nextDeadline: string;
  status: 'healthy' | 'attention' | 'urgent';
}

const mockDeadlines: Deadline[] = [
  {
    id: '1',
    vendor: 'Acme Software Solutions',
    type: 'notice',
    date: '2025-08-23',
    daysUntil: 7,
    status: 'urgent'
  },
  {
    id: '2',
    vendor: 'CloudTech Services',
    type: 'renewal',
    date: '2025-09-15',
    daysUntil: 30,
    status: 'upcoming'
  },
  {
    id: '3',
    vendor: 'DataFlow Systems',
    type: 'notice',
    date: '2025-10-01',
    daysUntil: 46,
    status: 'normal'
  },
  {
    id: '4',
    vendor: 'SecureNet Inc.',
    type: 'renewal',
    date: '2025-10-30',
    daysUntil: 75,
    status: 'normal'
  },
  {
    id: '5',
    vendor: 'TechFlow Solutions',
    type: 'termination',
    date: '2025-11-15',
    daysUntil: 91,
    status: 'normal'
  }
];

const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'Acme Software Solutions',
    activeContracts: 3,
    totalValue: '$245,000',
    nextDeadline: 'Aug 23',
    status: 'urgent'
  },
  {
    id: '2',
    name: 'CloudTech Services',
    activeContracts: 2,
    totalValue: '$180,000',
    nextDeadline: 'Sep 15',
    status: 'attention'
  },
  {
    id: '3',
    name: 'DataFlow Systems',
    activeContracts: 1,
    totalValue: '$95,000',
    nextDeadline: 'Oct 1',
    status: 'healthy'
  },
  {
    id: '4',
    name: 'SecureNet Inc.',
    activeContracts: 4,
    totalValue: '$320,000',
    nextDeadline: 'Oct 30',
    status: 'healthy'
  }
];

const getDeadlineIcon = (type: string) => {
  switch (type) {
    case 'notice':
      return <AlertTriangle size={16} />;
    case 'renewal':
      return <CheckCircle size={16} />;
    case 'termination':
      return <Clock size={16} />;
    default:
      return <Calendar size={16} />;
  }
};

const getStatusBadge = (status: string, type: 'deadline' | 'vendor') => {
  if (type === 'deadline') {
    switch (status) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'upcoming':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  } else {
    switch (status) {
      case 'urgent':
        return <Badge variant="destructive">Needs Attention</Badge>;
      case 'attention':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Monitor</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
    }
  }
};

export function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your contract renewals and upcoming deadlines
        </p>
      </div>

      {/* Upcoming Deadlines Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2>Upcoming Deadlines</h2>
          <Button variant="outline" size="sm">
            <Calendar size={16} className="mr-2" />
            View All
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {mockDeadlines.map((deadline) => (
                <div key={deadline.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {getDeadlineIcon(deadline.type)}
                        <span className="capitalize text-sm">{deadline.type}</span>
                      </div>
                      <div>
                        <p className="font-medium">{deadline.vendor}</p>
                        <p className="text-sm text-muted-foreground">
                          Due {deadline.date} • {deadline.daysUntil} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(deadline.status, 'deadline')}
                      <Button variant="ghost" size="sm">
                        <FileText size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Vendors at a Glance Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2>Vendors at a Glance</h2>
          <Button variant="outline" size="sm">
            View All Vendors
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{vendor.name}</CardTitle>
                  {getStatusBadge(vendor.status, 'vendor')}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contracts</p>
                    <p className="font-medium">{vendor.activeContracts}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Value</p>
                    <p className="font-medium">{vendor.totalValue}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Next Deadline</p>
                  <p className="font-medium">{vendor.nextDeadline}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}