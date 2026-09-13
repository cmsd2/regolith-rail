import { Page } from "../components/Page.tsx";

export function meta() {
  return [{ title: "Regolith Rail" }];
}

export default function Workbench() {
  return (
    <Page>
      <p style={{ padding: "1rem" }}>Workbench</p>
    </Page>
  );
}
