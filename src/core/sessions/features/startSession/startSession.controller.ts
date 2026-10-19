import { Request, Response } from "express";
import { StartSessionCommand } from "./startSession.command";
import { parseStartSessionRequest } from "./startSession.schema";

export class StartSessionController {
    constructor(private readonly startSession: StartSessionCommand) {}

    async handle(request: Request, response: Response) {
        try {
            const startSesionRequest = parseStartSessionRequest(request.body);
            const session = await this.startSession.execute(startSesionRequest)
            return response.status(201).json(session)
        }
        catch (error) {
            return sendStartSessionError(response, error)
        }
    }
}

function sendStartSessionError(response: Response, error: unknown) {
    return response.status(500).json({ error: 'Internal server error' })
}