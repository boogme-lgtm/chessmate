/**
 * Analysis router (Sprint 50 + Fix-1) — PGN self-analysis sessions.
 *
 * Both students AND coaches on a lesson can create, save, send, and list
 * analyses. Ownership is dual-path: the student-scoped db helpers try first;
 * if the caller isn't the student, the coach-scoped helpers try second. A
 * third party (neither student nor coach on the lesson) is always rejected.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { sendEmail } from "./emailService";

export const analysisRouter = router({
  // Create a new analysis session — coaches AND students can create.
  create: protectedProcedure
    .input(
      z.object({
        lessonId: z.number().optional(),
        contentItemId: z.number().optional(),
        originalPgn: z.string().min(1).max(500_000),
        title: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let coachId: number | null = null;
      let studentId: number = ctx.user.id; // standalone: the caller is the student

      if (input.lessonId) {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        const isStudent = lesson.studentId === ctx.user.id;
        const isCoach = lesson.coachId === ctx.user.id;
        if (!isStudent && !isCoach) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        coachId = lesson.coachId;
        studentId = lesson.studentId; // always the lesson's student, even when the coach creates
      }

      const { id } = await db.createPgnAnalysis({
        lessonId: input.lessonId ?? null,
        contentItemId: input.contentItemId ?? null,
        studentId,
        coachId,
        title: input.title,
        originalPgn: input.originalPgn,
        annotatedPgn: null,
        status: "draft",
      });
      return { id };
    }),

  // Save — try student ownership, then coach ownership.
  save: protectedProcedure
    .input(z.object({ id: z.number(), annotatedPgn: z.string().min(1).max(500_000) }))
    .mutation(async ({ ctx, input }) => {
      let updated = await db.updatePgnAnalysis(input.id, ctx.user.id, input.annotatedPgn);
      if (!updated) {
        updated = await db.updatePgnAnalysisForCoach(input.id, ctx.user.id, input.annotatedPgn);
      }
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      }
      return { ok: true };
    }),

  // Send the annotated PGN into the lesson chat. Direction is automatic:
  // student → coach, coach → student.
  sendToCoach: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      let analysis = await db.getPgnAnalysisById(input.id, ctx.user.id);
      const callerIsCoach = !analysis;
      if (!analysis) analysis = await db.getPgnAnalysisByIdForCoach(input.id, ctx.user.id);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      }
      if (!analysis.lessonId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No lesson context for this analysis" });
      }
      // Recipient: coach sends to student; student sends to coach.
      const recipientId = callerIsCoach ? analysis.studentId : analysis.coachId;
      if (!recipientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No recipient for this analysis" });
      }

      const pgn = analysis.annotatedPgn ?? analysis.originalPgn;

      if (input.note?.trim()) {
        await db.createMessage({
          lessonId: analysis.lessonId,
          senderId: ctx.user.id,
          contentType: "text",
          content: input.note.trim(),
        });
      }
      await db.createMessage({
        lessonId: analysis.lessonId,
        senderId: ctx.user.id,
        contentType: "pgn",
        content: pgn,
      });

      await db.markPgnAnalysisSent(input.id, pgn);

      // Best-effort email to the recipient.
      (async () => {
        try {
          const recipient = await db.getUserById(recipientId);
          if (!recipient?.email) return;
          const senderLabel = ctx.user.name ?? (callerIsCoach ? "Your coach" : "Your student");
          await sendEmail({
            to: recipient.email,
            subject: `${senderLabel} sent you an annotated game`,
            html: `<p>${senderLabel} sent you an annotated game: <strong>${analysis!.title}</strong>.</p><p>Open your lesson chat to review it on the analysis board.</p>`,
          });
        } catch (err) {
          console.error(`[analysis.sendToCoach] recipient email failed for analysis ${input.id}:`, err);
        }
      })();

      return { ok: true };
    }),

  // List — returns both student-side and coach-side analyses, deduped + sorted.
  myAnalyses: protectedProcedure.query(async ({ ctx }) => {
    const [asStudent, asCoach] = await Promise.all([
      db.listPgnAnalysesByStudent(ctx.user.id),
      db.listPgnAnalysesByCoach(ctx.user.id),
    ]);
    const seen = new Set<number>();
    return [...asStudent, ...asCoach]
      .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }),

  // Fetch — try student ownership, then coach ownership.
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      let row = await db.getPgnAnalysisById(input.id, ctx.user.id);
      if (!row) row = await db.getPgnAnalysisByIdForCoach(input.id, ctx.user.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      return row;
    }),
});
