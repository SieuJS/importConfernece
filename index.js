const { PrismaClient } = require('@prisma/client');
const parser = require('any-date-parser');
const prisma = new PrismaClient();

const saveConference = async (conferenceData) => {
    try {
        const conference = await prisma.conferences.upsert({
            where: {
                name_acronym: {
                    name: conferenceData.Name,
                    acronym: conferenceData.Acronym
                }
            },
            update: {},
            create: {
                name: conferenceData.Name,
                acronym: conferenceData.Acronym
            }
        });

        const { startDate, endDate } = splitDateRange(conferenceData["Conference dates"]);
        const { start_date, end_date } = {
            start_date: new Date(startDate),
            end_date: new Date(endDate),
        };
        const existsCfp = await prisma.call_for_papers.findFirst({
            where: {
                conference_id: conference.id,
                status: true
            }
        });
        let cfp;
        if (existsCfp ) {
            cfp = await prisma.call_for_papers.upsert({
                where: {
                    id: existsCfp.id
                },
                update: {
                    start_date,
                    end_date,
                    location : conferenceData.Location , 
                    link : conferenceData.Link,
                    access_type : conferenceData.Type,
                    status : start_date.getTime() > Date.now(),
                },
                create: {
                    conference_id: conference.id,
                    start_date,
                    end_date,
                    location : conferenceData.Location , 
                    link : conferenceData.Link,
                    access_type : conferenceData.Type,
                    status : start_date.getTime() > Date.now(),
                }
            });
        }else {
            cfp = await prisma.call_for_papers.create({
                data: {
                    conference_id: conference.id,
                    start_date,
                    end_date,
                    location : conferenceData.Location , 
                    link : conferenceData.Link,
                    access_type : conferenceData.Type,
                    status : start_date.getTime() > Date.now(),
                }
        });
        }
        console.log("CFP: ", cfp);

        const parsedDates = {
            "Submission date": [],
            "Notification date": [],
            "Camera-ready date": [],
            "Registration date": [],
            "Others": []
        };
        const important_dates = [];

        for (const [key, value] of Object.entries(conferenceData)) {
            if (key in parsedDates && value) {
                const matches = value.match(/(\w+ \d{1,2}, \d{4})/g);
                if (matches) {
                    await matches.forEach( async(dateStr ) => {
                        const date = parser.fromString(dateStr);
                        const existsDate = await prisma.important_dates.findFirst({
                            where: {
                                cfp_id: cfp.id,
                                date_type: key,
                            }
                        });
                        if (existsDate){
                            important_dates.push(await prisma.important_dates.updateMany({
                            where : {
                                cfp_id : cfp.id,
                                date_type : key
                            },
                            data : {
                                date_value : date,
                                status : date.getTime() > Date.now()
                            }

                        }));
                    } else {
                        important_dates.push(await prisma.important_dates.create({
                            data: {
                                cfp_id: cfp.id,
                                date_type: key,
                                date_value: date,
                                status : date.getTime() > Date.now()
                            }
                        }));
                    }
                    });
                }
            }
        }
        

        console.log("Response Data: ", important_dates);
    } catch (error) {
        console.error("Error saving data:", error.message);
    }
};

function splitDateRange(dateRange) {
    console.log("Splitting date range:", dateRange);
    let start;
    let end;
    try {
        if (dateRange.includes('–')) {
            [start, end] = dateRange.split('–').map(part => part.trim());
        } else {
            [start, end] = dateRange.split('-').map(part => part.trim());
        }
    } catch (e) {
        console.log("error in splitting date range", e);
        throw new Error("Invalid date format. Please check the input.");
    }

    const yearMatch = end.match(/\d{4}$/);
    const year = yearMatch ? yearMatch[0] : '';

    const [startMonth, startDay] = start.split(' ');

    let endMonth = startMonth;
    let endDay = '';

    if (end.includes(' ')) {
        const [potentialEndMonth, potentialEndDay] = end.replace(',', '').split(' ');
        if (isNaN(parseInt(potentialEndMonth))) {
            endMonth = potentialEndMonth;
            endDay = potentialEndDay;
        } else {
            endDay = potentialEndMonth;
        }
    } else {
        endDay = end.replace(',', '').trim();
    }

    const startDateString = `${startMonth} ${startDay}, ${year}`;
    const endDateString = `${endMonth} ${endDay}, ${year}`;

    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("Invalid date format. Please check the input.");
    }

    const formatDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    };
}



saveConference(
    {
        "Name": "National Conference of the American Association for Artificial Intelligence",
        "Acronym": "AAAI_Diff",
        "Link": "https://aaai.org/conference/aaai/aaai-25/",
        "Information": "Conference dates: February 25 – March 4, 2025\nLocation: Philadelphia, Pennsylvania, USA\nType: Offline (in-person)\nAAAI-25 web site open for paper submission: July 8, 2024\nAbstracts due: August 7, 2024\nFull papers due: August 15, 2024\nSupplementary material and code due: August 19, 2024\nNotification of Phase 1 rejections: October 14, 2024\nAuthor feedback window: November 4-8, 2024\nNotification of final acceptance or rejection (Main Technical Track): December 9, 2024\nSubmission of camera-ready files (Main Technical Track): December 19, 2024\nTopics: Artificial Intelligence, Machine Learning, Natural Language Processing, Computer Vision, Data Mining, Multiagent Systems, Knowledge Representation, Human-in-the-loop AI, Search, Planning, Reasoning, Robotics and Perception, Ethics, AI for Social Impact, AI Alignment",
        "Conference dates": "February 25 – March 4, 2025",
        "Location": "Philadelphia, Pennsylvania, USA",
        "Type": "Offline (in-person)",
        "Submission date": "AAAI-25 web site open for paper submission: July 8, 2024\nAbstracts due: August 7, 2024\nFull papers due: August 15, 2024\nSupplementary material and code due: August 19, 2024",
        "Notification date": "Notification of Phase 1 rejections: October 14, 2024\nNotification of final acceptance or rejection (Main Technical Track): December 9, 2024",
        "Camera-ready date": "Submission of camera-ready files (Main Technical Track): December 19, 2024",
        "Registration date": "",
        "Topics": "Artificial Intelligence, Machine Learning, Natural Language Processing, Computer Vision, Data Mining, Multiagent Systems, Knowledge Representation, Human-in-the-loop AI, Search, Planning, Reasoning, Robotics and Perception, Ethics, AI for Social Impact, AI Alignment",
        "Others": "Author feedback window: November 4-8, 2024"
      }
)