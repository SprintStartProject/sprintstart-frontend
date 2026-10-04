import { describe, expect, it } from "vitest";
import { BitbucketIcon } from "../../../../src/components/icons/BitbucketIcon";
import { getConnectorMeta, toConnectorListItems } from "../../../../src/features/connectors/data";

const connector = (id: string, name = `${id} connector`) => ({
  id,
  name,
  enabled: true,
  firstConfiguredAt: null,
  lastConfiguredAt: null,
});

describe("getConnectorMeta", () => {
  it("knows the Bitbucket connector and gives it the Bitbucket logo", () => {
    const meta = getConnectorMeta(connector("bitbucket"));

    expect(meta.label).toBe("Bitbucket Repository Connector");
    expect(meta.description).toMatch(/Bitbucket Cloud/);
    expect(meta.icon).toBe(BitbucketIcon);
  });

  it("still knows GitHub and Confluence", () => {
    expect(getConnectorMeta(connector("github")).label).toBe("GitHub Repository Connector");
    expect(getConnectorMeta(connector("confluence")).label).toBe("Confluence Cloud Connector");
  });

  it("falls back to the backend name for an unknown connector", () => {
    expect(getConnectorMeta(connector("sonarqube", "SonarQube")).label).toBe("SonarQube");
  });
});

describe("toConnectorListItems", () => {
  it("attaches the resolved meta to each connector", () => {
    const [item] = toConnectorListItems([connector("bitbucket")]);

    expect(item.id).toBe("bitbucket");
    expect(item.meta.label).toBe("Bitbucket Repository Connector");
  });
});
