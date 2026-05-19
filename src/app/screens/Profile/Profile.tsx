import {User, Edit2, ThumbsUp, Check, X, ThumbsDown, Stars, Settings} from 'lucide-react';
import {useState} from "react";
import {ProgressBar} from "@/app/components/ProgressBar.tsx";

export function Profile() {

    const [selectedRole, setSelectedRole] = useState("primary");

  return (
    <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
            <h1 className="font-semibold text-white">Profile & Personalization</h1>
        </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className=" flex flex-row gap-5">
                <div className="w-20 h-20 md:w-35 md:h-35 border-blue-500 flex items-center justify-center border-4 md:border-7 rounded-full">
                    <User className="w-12 h-12 md:w-25 md:h-25 text-blue-500"></User>
                </div>
                <div className=" flex flex-col justify-center">
                    <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                    <p className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white mt-1 md:mt-2">
                        @username
                    </p>
                </div>
            </div>

            <hr className="my-8 border-gray-300" />

          <div className="grid md:grid-cols-2 grid-cols-1 gap-2 md:gap-6">
              <h2 className="font-semibold">Name:</h2>
              <h2 className="text-lg flex justify-end md:justify-start">Prename Surname</h2>
              <h2 className="font-semibold md:row-start-2">Roles:</h2>
              <div className="flex flex-row gap-2 md:gap-4 justify-end md:justify-start">
                  <div className="rounded-2xl border-5 border-cyan-500 text-cyan-500 pl-2 pr-2 font-bold">
                      ROLE 1
                  </div>
                  <div className="rounded-2xl border-5 border-teal-500 text-teal-500 pl-2 pr-2 font-bold">
                      ROLE 2
                  </div>
              </div>
              <h2 className="font-semibold" >Level:</h2>
              <h2 className="font-bold flex justify-end md:justify-start text-lg">Intermediate</h2>
              <h2 className="font-semibold">Skills:</h2>
              <div className="grid-flow-row grid gap-3 grid-cols-3">
                  {[
                      'React',
                      'TypeScript',
                      'Node.js',
                      'PostgreSQL',
                      'Docker',
                      'Kubernetes',
                      'AWS',
                      'GraphQL',
                  ].map((skill) => (
                      <div
                          key={skill}
                          className="flex justify-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg"
                      >
                  {skill}
                </div>
                  ))}
              </div>
              <div className="flex flex-row justify-end md:col-start-2">
                  <button className="h-12 w-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm transition-colors flex items-center justify-center gap-2">
                      <Edit2 className="w-5 h-5" />
                  </button>
              </div>
          </div>
        </div>

        {/* Skill Gaps */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h1 className="font-bold">Skill Gaps</h1>

            <div className="inline-flex p-1 gap-1 mt-3 bg-gray-100 dark:bg-gray-800 rounded-3xl">
                <button
                    className={`px-5 rounded-3xl transition-all duration-200 font-medium ${
                        selectedRole === "primary"
                            ? "bg-white dark:bg-gray-700 shadow text-black dark:text-white"
                            : "text-gray-500 dark:text-gray-400"
                    }`}
                    onClick={() => setSelectedRole("primary")}
                >
                    Primary Role
                </button>

                <button
                    className={`px-5 rounded-3xl transition-all duration-200 font-medium ${
                        selectedRole === "secondary"
                            ? "bg-white dark:bg-gray-700 shadow text-black dark:text-white"
                            : "text-gray-500 dark:text-gray-400"
                    }`}
                    onClick={() => setSelectedRole("secondary")}
                >
                    Secondary Role
                </button>
            </div>

            <div className="flex flex-row gap-3 items-center mt-5">
                <span>Evaluation for role</span>
                <div className="rounded-2xl border-5 border-cyan-500 text-cyan-500 pl-2 pr-2 font-bold">
                    ROLE 1
                </div>
                <span>:</span>
            </div>

            <div className="flex flex-row gap-5 items-center mt-1">
                <ProgressBar value={60} max={100} size="lg" />
                <span className="text-3xl font-bold text-blue-400">60%</span>
            </div>

            <p className="mt-5">Skill requirements:</p>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-0">
                <div className="grid md:grid-cols-6 mt-3">
                    <div className="grid md:grid-cols-6 gap-2 md:gap-5 md:col-start-1 md:col-span-5">
                        {[
                            'React',
                            'TypeScript',
                            'Node.js'
                        ].map((skill) => (
                            <div
                                key={skill}
                                className="h-8 flex justify-center px-3 py-1.5 bg-green-200 text-green-700 text-sm rounded-lg"
                            >
                                {skill}
                            </div>
                        ))}
                    </div>
                    <div className="md:col-start-6 md:col-span-1 text-green-700 font-semibold flex items-center justify-center text-lg mt-3 md:mt-0">
                        <Check></Check> 3/5
                    </div>
                </div>

                <div className="grid md:grid-cols-6 mt-3">
                    <div className="grid md:grid-cols-6 gap-2 md:gap-5 md:col-start-1 md:col-span-5">
                        {[
                            'HTML',
                            'CSS',
                        ].map((skill) => (
                            <div
                                key={skill}
                                className="h-8 flex justify-center px-3 py-1.5 bg-red-200 text-red-700 text-sm rounded-lg"
                            >
                                {skill}
                            </div>
                        ))}
                        <div className="h-8"></div>
                    </div>
                    <div className="md:col-start-6 md:col-span-1 text-red-700 font-semibold flex items-center justify-center text-lg mt-3 md:mt-0">
                        <X></X> 2/5
                    </div>
                </div>
            </div>

            <hr className="my-8 border-gray-300" />

            <div className="flex flex-row gap-2 items-center">
                <Stars className="size-6"></Stars>
                <span>Recommended Ressources:</span>
            </div>
            <div className="grid gap-3 mt-5">
                    {[
                        'Advanced Kubernetes Patterns',
                        'Microservices Architecture Best Practices',
                        'Performance Tuning in Node.js',
                    ].map((item) => (
                        <div
                            key={item}
                            className="p-3 pt-2 pb-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white flex flex-row justify-between items-center"
                        >
                            <div>{item}</div>
                            <div className="flex flex-row gap-3">
                                <ThumbsUp className="text-blue-500"></ThumbsUp>
                                <ThumbsDown className="text-blue-500"></ThumbsDown>
                            </div>
                        </div>
                    ))}
            </div>
        </div>

        {/* Configurations */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings></Settings>
            <h2 className="font-semibold text-gray-900 dark:text-white">
                Configurations
            </h2>
          </div>
        </div>

      </div>
    </div>
  );
}
