"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Upload, FileText, Eye, Calendar, CheckCircle, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { AgreementDrawer } from './AgreementDrawer';

interface Agreement {
  id: string;
  vendor: string;
  title: string;
  effectiveDate: string;
  endDate: string;
  autoRenew: boolean;
  noticeDays: number;
  status: 'active' | 'expiring' | 'expired';
  fileName: string;
}

const mockAgreements: Agreement[] = [
  {
    id: '1',
    vendor: 'Acme Software Solutions',
    title: 'Software Licensing Agreement',
    effectiveDate: '2024-01-15',
    endDate: '2025-01-15',
    autoRenew: true,
    noticeDays: 60,
    status: 'expiring',
    fileName: 'acme-software-license.pdf'
  },
  {
    id: '2',
    vendor: 'CloudTech Services',
    title: 'Cloud Infrastructure Services',
    effectiveDate: '2023-09-01',
    endDate: '2025-09-01',
    autoRenew: false,
    noticeDays: 90,
    status: 'active',
    fileName: 'cloudtech-infrastructure.pdf'
  },
  {
    id: '3',
    vendor: 'DataFlow Systems',
    title: 'Data Processing Agreement',
    effectiveDate: '2024-03-01',
    endDate: '2026-03-01',
    autoRenew: true,
    noticeDays: 30,
    status: 'active',
    fileName: 'dataflow-processing.pdf'
  },
  {
    id: '4',
    vendor: 'SecureNet Inc.',
    title: 'Cybersecurity Services Contract',
    effectiveDate: '2023-11-15',
    endDate: '2025-11-15',
    autoRenew: true,
    noticeDays: 45,
    status: 'active',
    fileName: 'securenet-cybersecurity.pdf'
  },
  {
    id: '5',
    vendor: 'TechFlow Solutions',
    title: 'Consulting Services Agreement',
    effectiveDate: '2024-06-01',
    endDate: '2024-12-01',
    autoRenew: false,
    noticeDays: 30,
    status: 'expired',
    fileName: 'techflow-consulting.pdf'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case 'expiring':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Expiring</Badge>;
    case 'expired':
      return <Badge variant="destructive">Expired</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export function Documents() {
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleViewAgreement = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setIsDrawerOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Handle file upload logic here
    const files = Array.from(e.dataTransfer.files);
    console.log('Files dropped:', files);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="mb-2">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage your contract documents
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-border/80"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Upload size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop your PDF files here</p>
                <p className="text-muted-foreground">or click to browse</p>
              </div>
              <Button>Choose Files</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Agreements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Agreements</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Calendar size={16} className="mr-2" />
                Filter by Date
              </Button>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Auto-Renew</TableHead>
                <TableHead>Notice Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAgreements.map((agreement) => (
                <TableRow key={agreement.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{agreement.vendor}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-muted-foreground" />
                      {agreement.title}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(agreement.effectiveDate)}</TableCell>
                  <TableCell>{formatDate(agreement.endDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {agreement.autoRenew ? (
                        <>
                          <CheckCircle size={16} className="text-green-600" />
                          <span>Yes</span>
                        </>
                      ) : (
                        <>
                          <X size={16} className="text-red-600" />
                          <span>No</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{agreement.noticeDays} days</TableCell>
                  <TableCell>{getStatusBadge(agreement.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewAgreement(agreement)}
                    >
                      <Eye size={16} className="mr-2" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agreement Drawer */}
      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agreement={selectedAgreement}
      />
    </div>
  );
}