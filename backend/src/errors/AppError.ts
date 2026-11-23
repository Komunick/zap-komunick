class AppError {
  public readonly message: string;

  public readonly statusCode: number;

  public readonly level: string;

  // Zap Komunick: optional data the screen can use (e.g. who has the open
  // ticket in ERR_OTHER_OPEN_TICKET). Never put secrets here.
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    level = "warn",
    details?: Record<string, unknown>
  ) {
    this.message = message;
    this.statusCode = statusCode;
    this.level = level;
    this.details = details;
  }
}

export default AppError;
