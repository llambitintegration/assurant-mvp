import {IPassportSession} from "../interfaces/passport-session";

export class AuthResponse {
  public authenticated = false;
  public user: IPassportSession | null = null;
  public title: string | null = null;
  public auth_error: string | null = null;
  public message: string | null = null;

  constructor(title: string | null, authenticated: boolean, user: IPassportSession | null, auth_error: string | null, message: string | null) {
    this.title = title;
    this.authenticated = !!authenticated;
    this.user = user;
    this.auth_error = auth_error;
    this.message = message;
  }
}
