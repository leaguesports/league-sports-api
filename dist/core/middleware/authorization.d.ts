import { Request, Response, NextFunction } from "express";
import { Config } from "../../config";
export declare function makeAuthorizationMiddleware(config: Config): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=authorization.d.ts.map