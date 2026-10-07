import { apiSuccess, handleApiError } from "@/lib/api-error";
import { requireSession } from "@/server/auth-guard";
import {
  handleManualTransition,
  ManualTransitionAction,
} from "@/server/services/project-transition.service";
import { NextRequest } from "next/server";
import { z } from "zod";

const transitionSchema = z.object({
  action: z.enum([
    "START_SURVEY",
    "START_PHYSICAL_WORK",
    "REQUEST_BAST",
    "HOLD",
    "RESUME",
    "CANCEL",
  ]),
  reason: z.string().optional(),
  remarks: z.string().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const validated = transitionSchema.parse(body);

    const updatedProject = await handleManualTransition({
      projectId: params.id,
      actorId: session.user.id,
      actorRole: session.user.role,
      action: validated.action as ManualTransitionAction,
      reason: validated.reason,
      remarks: validated.remarks,
    });

    return apiSuccess(updatedProject);
  } catch (error) {
    return handleApiError(error);
  }
}
