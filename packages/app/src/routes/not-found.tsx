import { Link } from "react-router";
import { Page } from "../components/Page.tsx";

export function meta() {
  return [{ title: "Not found · Regolith Rail" }];
}

export default function NotFound() {
  return (
    <Page>
      <div style={{ padding: "2rem" }}>
        <h1>Page not found</h1>
        <p>
          There is nothing at this address. Try the <Link to="/">workbench</Link> or the{" "}
          <Link to="/docs">documentation</Link>.
        </p>
      </div>
    </Page>
  );
}
