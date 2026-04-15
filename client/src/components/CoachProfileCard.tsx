import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// Title → color mapping for ambient corner glow + avatar gradient
function glowForTitle(title: string): string {
  const t = title.toUpperCase();
  if (t.includes("GM")) return "rgba(114, 47, 55, 0.2)"; // burgundy
  if (t.includes("IM")) return "rgba(194, 122, 74, 0.2)"; // terracotta
  if (t.includes("FM")) return "rgba(123, 104, 238, 0.15)"; // iris
  return "rgba(45, 90, 74, 0.15)"; // forest
}

export function CoachProfileCard({ coach, onBookClick }: CoachProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="glass-card h-full flex flex-col overflow-hidden">
        <div className="card-glow" style={{ background: glowForTitle(coach.title) }} />

        {/* Coach Image */}
        <div className="relative aspect-[4/5] overflow-hidden bg-charcoal">
          <img
            src={coach.imageUrl}
            alt={coach.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute top-3 right-3">
            <span className="glass-badge text-[11px]">{coach.title}</span>
          </div>
        </div>

        {/* Coach Info */}
        <div className="p-[18px] space-y-4 flex-1 flex flex-col relative z-10">
          {/* Name and Rating */}
          <div>
            <h3 className="text-[16px] font-medium text-[#FAF8F5] mb-1 leading-tight">{coach.name}</h3>
            <div className="flex items-center gap-3 text-[11px] text-white/35">
              <span className="stat-number">{coach.rating} FIDE</span>
              {coach.reviewRating && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#B8860B] text-[#B8860B]" />
                  <span className="text-[#B8860B]">{coach.reviewRating.toFixed(1)}</span>
                </div>
              )}
              {coach.studentCount && (
                <span>{coach.studentCount}+ students</span>
              )}
            </div>
          </div>

          {/* Location and Languages */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/35">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{coach.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>{coach.languages.join(", ")}</span>
            </div>
          </div>

          {/* Bio */}
          <p className="text-[12px] text-white/40 leading-relaxed line-clamp-3 flex-1">
            {coach.bio}
          </p>

          {/* Specializations */}
          <div className="flex flex-wrap gap-1.5">
            {coach.specializations.slice(0, 3).map((spec, index) => (
              <span
                key={index}
                className="text-[10px] bg-white/[0.06] text-white/50 rounded-lg px-2 py-0.5"
              >
                {spec}
              </span>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-baseline justify-between pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] text-white/35">
              <Clock className="w-3 h-3" />
              <span>{coach.availability}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[14px] font-medium text-[#FAF8F5]">${coach.hourlyRate}</span>
              <span className="text-[11px] text-white/30">/hr</span>
            </div>
          </div>

          {/* Book Button */}
          <Button onClick={onBookClick} className="w-full btn-glass-primary" size="lg">
            Book Lesson
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
