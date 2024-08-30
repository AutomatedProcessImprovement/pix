import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Footer } from "~/components/Footer";
import Header from "~/components/Header";
import type { Project } from "~/services/projects";
import { listProjectsForUser } from "~/services/projects.server";
import { requireLoggedInUser } from "~/shared/guards.server";
import { getFlashMessage, sessionStorage } from "~/shared/session.server";
import { handleThrow } from "~/shared/utils";
import { useFlashMessage } from "../_index/route";
import { UserContext } from "../contexts";
import NewProjectCard from "./components/NewProjectCard";
import ProjectCard from "./components/ProjectCard";

export const meta: MetaFunction = ({ matches }) => {
  const rootMeta = matches.find((match) => match.id === "root")?.meta as
    | { title?: string; description?: string }[]
    | undefined;
  const title = rootMeta?.find((meta) => meta.title)?.title;
  const description = rootMeta?.find((meta) => meta.description)?.description;

  return [
    { title: `Projects —— ${title}` },
    {
      name: "description",
      content: description,
    },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireLoggedInUser(request);
  const [flashMessage, session] = await getFlashMessage(request);
  return handleThrow(request, async () => {
    const projects = await listProjectsForUser(user.id, user.token!);
    return json(
      { user, projects, flashMessage },
      { headers: { "Set-Cookie": await sessionStorage.commitSession(session) } }
    );
  });
};

export default function ProjectsPage() {
  const { user, projects, flashMessage } = useLoaderData<typeof loader>();
  useFlashMessage(flashMessage);
  if (!user) return <p>User not found, try to reload the page.</p>;

  return (
    <div className="flex flex-col h-screen justify-between">
      <UserContext.Provider value={user}>
        <div>
          <Header userEmail={user.email} />
          <section className="p-6 flex flex-col space-y-4">
            <div className="flex justify-center">
              <ul className="flex-grow grid lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 gap-6">
                {projects && projects.map((project: Project) => <ProjectCard key={project.id} project={project} />)}
                <NewProjectCard />
              </ul>
            </div>
          </section>
        </div>
        <Footer />
      </UserContext.Provider>
    </div>
  );
}
