'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SubjectForm } from '../../../../../../components/subjects/SubjectForm';

export default function EditSubjectPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const [subject, setSubject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/subjects/${subjectId}`, { credentials: 'include' });
      if (res.ok) {
        setSubject(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, [subjectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subject) {
    return <div className="text-center py-20 text-slate-500">Subject not found.</div>;
  }

  return <SubjectForm initialData={subject} isEditing />;
}
