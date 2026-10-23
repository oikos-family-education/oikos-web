import type React from 'react';
import {
  BookOpen, FileText, Video, GraduationCap, Headphones, Film, FileSpreadsheet, Globe, Package, HelpCircle,
} from 'lucide-react';

export const TYPE_ICONS: Record<string, React.ElementType> = {
  book: BookOpen, article: FileText, video: Video, course: GraduationCap,
  podcast: Headphones, documentary: Film, printable: FileSpreadsheet,
  website: Globe, curriculum: Package, other: HelpCircle,
};
