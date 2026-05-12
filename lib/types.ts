export interface Project {
  id: string;
  slug: string;
  title: string;
  badge: string;
  description: string;
  tags: string[];
  links: Record<string, string>; // { github, live, demo, ... }
  image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  slug: string;
  org: string;
  org_url: string | null;
  role: string;
  type: string; // work | education | project | volunteer
  date_range: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  tags: string[];
  location: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SiteContent {
  key: string;
  value: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      projects: { Row: Project; Insert: Omit<Project, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Project, "id">>; };
      experience: { Row: Experience; Insert: Omit<Experience, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Experience, "id">>; };
      site_content: { Row: SiteContent; Insert: SiteContent; Update: Partial<SiteContent>; };
    };
  };
}
