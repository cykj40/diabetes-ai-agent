import React from 'react';
import { Disclosure } from '@headlessui/react';
import { FiChevronDown, FiAlertTriangle, FiCode } from 'react-icons/fi';

export default function PelotonTroubleshootingInfo() {
    return (
        <div className="mt-6 border-t pt-4">
            <h3 className="text-md font-medium mb-2 flex items-center">
                <FiAlertTriangle className="text-amber-500 mr-2" />
                Troubleshooting Connection Issues
            </h3>

            <div className="space-y-2 text-sm">
                <Disclosure>
                    {({ open }) => (
                        <div>
                            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring">
                                <span>Status code 400 or "Bad Request" errors</span>
                                <FiChevronDown
                                    className={`${open ? 'transform rotate-180' : ''} w-5 h-5`}
                                />
                            </Disclosure.Button>
                            <Disclosure.Panel className="px-4 pt-2 pb-3 text-sm text-gray-600">
                                A status code 400 typically indicates a problem with the request parameters:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Your Peloton session may have expired. Try disconnecting and reconnecting your account.</li>
                                    <li>The API request format may be incorrect. The latest Peloton API requires your specific user ID in the URL.</li>
                                    <li>Peloton's API may have changed. We've updated our integration to use the latest format.</li>
                                </ul>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                <Disclosure>
                    {({ open }) => (
                        <div>
                            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring">
                                <span>Status code 401 or "Unauthorized" errors</span>
                                <FiChevronDown
                                    className={`${open ? 'transform rotate-180' : ''} w-5 h-5`}
                                />
                            </Disclosure.Button>
                            <Disclosure.Panel className="px-4 pt-2 pb-3 text-sm text-gray-600">
                                A status code 401 indicates an authentication problem:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Your Peloton session has expired and needs to be refreshed.</li>
                                    <li>Your Peloton password may have changed since you connected.</li>
                                    <li>Try disconnecting your account and reconnecting with your current Peloton credentials.</li>
                                </ul>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                <Disclosure>
                    {({ open }) => (
                        <div>
                            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring">
                                <span>Correct Peloton API Format</span>
                                <FiChevronDown
                                    className={`${open ? 'transform rotate-180' : ''} w-5 h-5`}
                                />
                            </Disclosure.Button>
                            <Disclosure.Panel className="px-4 pt-2 pb-3 text-sm text-gray-600">
                                <p className="mb-2">The latest Peloton API requires using your specific user ID in the request URL:</p>
                                <div className="bg-gray-100 p-3 rounded font-mono text-xs mb-2 overflow-x-auto">
                                    GET https://api.onepeloton.com/api/user/<b>&lt;user_id&gt;</b>/workouts?limit=10&page=0
                                </div>
                                <p className="mb-2">Our application now:</p>
                                <ol className="list-decimal pl-5 mb-2 space-y-1">
                                    <li>First fetches your user ID via the <code>/api/me</code> endpoint</li>
                                    <li>Then uses that ID to request workouts with the correct URL format</li>
                                    <li>Includes all required headers (Cookie, User-Agent, Accept)</li>
                                </ol>
                                <p>This format change was implemented in latest version.</p>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                <Disclosure>
                    {({ open }) => (
                        <div>
                            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring">
                                <span>Status code 429 or "Too Many Requests" errors</span>
                                <FiChevronDown
                                    className={`${open ? 'transform rotate-180' : ''} w-5 h-5`}
                                />
                            </Disclosure.Button>
                            <Disclosure.Panel className="px-4 pt-2 pb-3 text-sm text-gray-600">
                                A status code 429 indicates you've hit Peloton's rate limits:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>The system will automatically retry your request after backing off.</li>
                                    <li>Try again later if the problem persists.</li>
                                    <li>Avoid making too many requests in a short period of time.</li>
                                </ul>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                <Disclosure>
                    {({ open }) => (
                        <div>
                            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring">
                                <span>General troubleshooting steps</span>
                                <FiChevronDown
                                    className={`${open ? 'transform rotate-180' : ''} w-5 h-5`}
                                />
                            </Disclosure.Button>
                            <Disclosure.Panel className="px-4 pt-2 pb-3 text-sm text-gray-600">
                                If you're experiencing connection issues:
                                <ol className="list-decimal pl-5 mt-2 space-y-1">
                                    <li>Disconnect your Peloton account using the button above</li>
                                    <li>Wait a few minutes</li>
                                    <li>Reconnect with your current Peloton credentials</li>
                                    <li>Make sure you can log into the Peloton website or app directly</li>
                                    <li>If issues persist, contact support for further assistance</li>
                                </ol>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>
            </div>
        </div>
    );
} 