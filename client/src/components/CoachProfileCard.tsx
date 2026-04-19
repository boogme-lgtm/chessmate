import { MapPin, Globe, Star, Clock } from "lucide-react";
import { motion } from "framer-motion";

export type TimeSlot = "morning" | "afternoon" | "evening" | "weekend";
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface DetailedAvailability {
  days: DayOfWeek[];
  timeSlots: TimeSlot[];
  timezoneOffset: number; // UTC offset in hours (e.g., -8 for PST, +1 for CET)
}

export interface CoachProfile {
  id: string;
  name: string;
  title: string;
  rating: number;
  location: string;
  timezone: string;
  languages: string[];
  hourlyRate: number;
  imageUrl: string;
  specializations: string[];
  teachingStyle: string;
  targetRating: string;
  availability: string; // Human-readable summary
  detailedAvailability: DetailedAvailability;
  studentCount?: number;
  reviewRating?: number;
  bio: string;
}

interface CoachProfileCardProps {
  coach: CoachProfile;
  onBookClick?: () => void;
}

export function CoachProfileCard({ coach, onBookClick }: CoachProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="border border-border bg-background h-full flex flex-col overflow-hidden hover:border-foreground/30 transition-colors">
        {/* Coach Image — full bleed, mono title pill in the corner */}
        <div className="relative aspect-[4/5] overflow-hidden" style={{ background: "var(--surface)" }}>
          <img
            src={coach.imageUrl}
            alt={coach.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute top-3 right-3">
            <span className="editorial-pill" style={{ background: "var(--background)" }}>
              {coach.title}
            </span>
          </div>
        </div>

        {/* Coach Info */}
        <div className="p-5 space-y-4 flex-1 flex flex-col">
          <div>
            <h3 className="text-[18px] font-medium text-foreground mb-1 leading-tight">
              {coach.name}
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="stat-number">{coach.rating} FIDE</span>
              {coach.reviewRating && (
                <div className="flex items-center gap-1 text-signal">
                  <Star className="w-3 h-3 fill-current" />
                  <span>{coach.reviewRating.toFixed(1)}</span>
                </div>
              )}
              {coach.studentCount && <span>{coach.studentCount}+ students</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{coach.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>{coach.languages.join(", ")}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            {coach.bio}
          </p>

          {/* Specializations — mono uppercase chips */}
          <div className="flex flex-wrap gap-1.5">
            {coach.specializations.slice(0, 3).map((spec) => (
              <span
                key={spec}
                className="font-mono text-[10px] uppercase tracking-[0.14em] border border-border text-muted-foreground rounded-full px-2 py-0.5"
              >
                {spec}
              </span>
            ))}
          </div>

          <div className="flex items-baseline justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{coach.availability}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-medium text-foreground">${coach.hourlyRate}</span>
              <span className="text-[11px] text-muted-foreground">/hr</span>
            </div>
          </div>

          <button onClick={onBookClick} className="btn-editorial-primary w-full mt-2">
            Book a trial lesson
          </button>
          <p className="mono-label text-center">
            You won&rsquo;t be charged until the lesson ends.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
