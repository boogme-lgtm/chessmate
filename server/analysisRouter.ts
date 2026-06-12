/**
 * Analysis router (Sprint 50) — student PGN self-analysis sessions.
 *
 * create / save / sendToCoach / myAnalyses / byId. All procedures are scoped
 * to the authenticated student (ownership enforced in the db helpers' WHERE
 * clauses). When a lesson context is provided, the coach is derived from the
 * LESSON row server-side — the client-supplied coachId is never trusted.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { sendEmail } from "./emailService";

export const analysisRouter = router({
  // Create a new analysis session.
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
      // Derive the coach from the lesson (never from the client) and verify
      // the caller is actually the student on that lesson.
      let coachId: number | null = null;
      if (input.lessonId) {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        coachId = lesson.coachId;
      }

      const { id } = await db.createPgnAnalysis({
        lessonId: input.lessonId ?? null,
        contentItemId: input.contentItemId ?? null,
        studentId: ctx.user.id,
        coachId,
        title: input.title,
        originalPgn: input.originalPgn,
        annotatedPgn: null,
        status: "draft",
      });
      return { id };
    }),

  // Save the current annotated PGN (ownership enforced by the WHERE clause).
  save: protectedProcedure
    .input(z.object({ id: z.number(), annotatedPgn: z.string().min(1).max(500_000) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db.updatePgnAnalysis(input.id, ctx.user.id, input.annotatedPgn);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      }
      return { ok: true };
    }),

  // Send the annotated PGN to the coach as a lesson chat message.
  sendToCoach: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const analysis = await db.getPgnAnalysisById(input.id, ctx.user.id);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      }
      if (!analysis.lessonId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No lesson context for this analysis" });
      }
      if (!analysis.coachId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No coach context for this analysis" });
      }

      const pgn = analysis.annotatedPgn ?? analysis.originalPgn;

      // The PGN goes into the lesson chat as a pgn message (opens the analysis
      // board on click). An optional personal note precedes it as a normal
      // text message so it reads naturally in the thread.
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

      // Best-effort coach email (the chat unread badge is the in-app signal).
      // NOTE: notifyOwner() from the handoff notifies the PLATFORM owner, not
      // the coach — an email to the coach is what was actually intended.
      (async () => {
        try {
          const coach = await db.getUserById(analysis.coachId!);
          if (!coach?.email) return;
          await sendEmail({
            to: coach.email,
            subject: `${ctx.user.name ?? "Your student"} sent you an annotated game`,
            html: `<p>${ctx.user.name ?? "Your student"} sent you an annotated game: <strong>${analysis.title}</strong>.</p><p>Open your lesson chat to review it on the analysis board.</p>`,
          });
        } catch (err) {
          console.error(`[analysis.sendToCoach] coach email failed for analysis ${input.id}:`, err);
        }
      })();

      return { ok: true };
    }),

  // List the caller's analyses, most recently updated first.
  myAnalyses: protectedProcedure.query(async ({ ctx }) => {
    return await db.listPgnAnalysesByStudent(ctx.user.id);
  }),

  // Fetch one analysis (caller must own it).
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await db.getPgnAnalysisById(input.id, ctx.user.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      return row;
    }),
});
