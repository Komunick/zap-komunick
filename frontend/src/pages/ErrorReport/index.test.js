import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ErrorReport from ".";
import api from "../../services/api";
import {
  ERROR_REPORT_MAX_TOTAL_BYTES,
  addErrorReportFiles,
  isErrorReportFile
} from "../../helpers/errorReportFiles";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));
jest.mock("../../components/MainContainer", () => ({ children }) => (
  <div>{children}</div>
));
jest.mock("../../components/MainHeader", () => ({ children }) => (
  <div>{children}</div>
));
jest.mock("../../components/Title", () => ({ children }) => (
  <h1>{children}</h1>
));
jest.mock("../../translate/i18n", () => {
  const texts = {
    "errorReport.title": "Reportar erro",
    "errorReport.intro": "Conte o que aconteceu.",
    "errorReport.fields.title": "Resumo do problema",
    "errorReport.fields.location": "Em qual tela aconteceu?",
    "errorReport.fields.description": "O que aconteceu?",
    "errorReport.attachments.title": "Anexos",
    "errorReport.attachments.drop": "Arraste os arquivos",
    "errorReport.attachments.choose": "Escolher arquivos",
    "errorReport.submit": "Enviar reporte",
    "errorReport.sending": "Enviando…",
    "errorReport.sentTitle": "Reporte enviado",
    "errorReport.another": "Enviar outro reporte",
    "errorReport.errors.required": "Preencha o resumo e conte o que aconteceu.",
    "errorReport.errors.request": "Não foi possível enviar o reporte.",
    "backendErrors.ERR_ERROR_REPORT_RATE_LIMIT": "Muitos reportes."
  };
  const t = (key, values = {}) => {
    if (key === "errorReport.sent")
      return `Recebemos o reporte nº ${values.id}.`;
    if (key === "errorReport.errors.type")
      return `${values.name} não é imagem, vídeo nem PDF.`;
    if (key === "errorReport.errors.tooMany")
      return `São no máximo ${values.count} arquivos.`;
    if (key === "errorReport.errors.tooLarge")
      return `Os anexos passam de ${values.size} MB.`;
    if (key === "errorReport.attachments.remove")
      return `Remover ${values.name}`;
    return texts[key] || key;
  };
  return { i18n: { t, exists: key => key in texts } };
});

const file = (name, type, size = 1024) => {
  const item = new File(["x"], name, { type });
  Object.defineProperty(item, "size", { value: size });
  return item;
};

const fill = () => {
  fireEvent.change(screen.getByLabelText(/Resumo do problema/), {
    target: { value: "  Tela trava  " }
  });
  fireEvent.change(screen.getByLabelText(/O que aconteceu/), {
    target: { value: "Ao enviar um anexo." }
  });
};

const chooseFiles = files =>
  fireEvent.change(screen.getByLabelText("Escolher arquivos"), {
    target: { files }
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("error report files", () => {
  it("accepts images, videos and PDF only", () => {
    expect(isErrorReportFile(file("a.png", "image/png"))).toBe(true);
    expect(isErrorReportFile(file("a.mp4", "video/mp4"))).toBe(true);
    expect(isErrorReportFile(file("a.pdf", "application/pdf"))).toBe(true);
    expect(isErrorReportFile(file("a.MOV", ""))).toBe(true);
    expect(isErrorReportFile(file("a.exe", "application/x-msdownload"))).toBe(
      false
    );
    expect(isErrorReportFile(file("a.svg", "image/svg+xml"))).toBe(false);
    expect(isErrorReportFile(file("sem-extensao", ""))).toBe(false);
  });

  it("stops at five files and at the total size", () => {
    const five = Array.from({ length: 5 }, (_, index) =>
      file(`p${index}.png`, "image/png")
    );
    expect(addErrorReportFiles(five, [file("p5.png", "image/png")])).toEqual({
      files: five,
      rejected: { code: "tooMany" }
    });

    const big = file("v.mp4", "video/mp4", ERROR_REPORT_MAX_TOTAL_BYTES);
    expect(addErrorReportFiles([big], [file("p.png", "image/png")])).toEqual({
      files: [big],
      rejected: { code: "tooLarge" }
    });
  });
});

describe("ErrorReport page", () => {
  it("asks for the summary and the description before sending", () => {
    render(<ErrorReport />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Preencha o resumo e conte o que aconteceu."
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends the text and the attachments and shows the report number", async () => {
    api.post.mockResolvedValue({ data: { id: 42 } });
    render(<ErrorReport />);
    fill();
    fireEvent.change(screen.getByLabelText(/Em qual tela aconteceu/), {
      target: { value: "Atendimentos" }
    });
    const print = file("print.png", "image/png");
    const pdf = file("relatorio.pdf", "application/pdf");
    chooseFiles([print, pdf]);
    expect(screen.getByText("print.png")).toBeInTheDocument();
    expect(screen.getByText("relatorio.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Recebemos o reporte nº 42."
    );
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe("/error-reports");
    expect(form.get("title")).toBe("Tela trava");
    expect(form.get("location")).toBe("Atendimentos");
    expect(form.get("description")).toBe("Ao enviar um anexo.");
    expect(form.get("screen")).toMatch(/^\d+x\d+$/);
    expect(form.getAll("files").map(item => item.name)).toEqual([
      "print.png",
      "relatorio.pdf"
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar outro reporte" })
    );
    expect(screen.getByLabelText(/Resumo do problema/)).toHaveValue("");
  });

  it("refuses a file that is not an image, a video or a PDF", () => {
    render(<ErrorReport />);

    chooseFiles([file("planilha.xlsx", "application/vnd.ms-excel")]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "planilha.xlsx não é imagem, vídeo nem PDF."
    );
    expect(screen.queryByText("planilha.xlsx")).not.toBeInTheDocument();
  });

  it("takes a pasted screenshot and lets the user remove it", () => {
    render(<ErrorReport />);
    const print = file("image.png", "image/png");

    fireEvent.paste(document, { clipboardData: { files: [print] } });
    expect(screen.getByText("image.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover image.png" }));
    expect(screen.queryByText("image.png")).not.toBeInTheDocument();
  });

  it("takes dropped files", () => {
    render(<ErrorReport />);

    fireEvent.drop(screen.getByTestId("error-report-drop"), {
      dataTransfer: { files: [file("video.mp4", "video/mp4")] }
    });

    expect(screen.getByText("video.mp4")).toBeInTheDocument();
  });

  it("keeps what was typed and shows the reason when the server refuses", async () => {
    api.post.mockRejectedValue({
      response: { data: { error: "ERR_ERROR_REPORT_RATE_LIMIT" } }
    });
    render(<ErrorReport />);
    fill();

    fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Muitos reportes.")
    );
    expect(screen.getByLabelText(/O que aconteceu/)).toHaveValue(
      "Ao enviar um anexo."
    );
  });
});
