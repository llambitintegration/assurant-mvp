export declare type Params = {
  [key: string]: any;
};

export default class WorklenzNotification {
  public team: string;
  public team_id: string;
  public message: string;
  public url: string | null;
  public project?: string;
  public color?: string;
  public params?: Params;
  public task_id?: string;
  public project_id?: string;

  constructor(teamName: string, teamId: string, message: string, url: string | null) {
    this.team = teamName;
    this.team_id = teamId;
    this.message = message;
    this.url = url;
  }

  public setProject(name: string) {
    this.project = name;
  }

  public setColor(code: string) {
    this.color = code;
  }

  public setParams(params: Params) {
    this.params = params;
  }

  public setTaskId(id: string) {
    this.task_id = id;
  }

  public setProjectId(id: string) {
    this.project_id = id;
  }
}
