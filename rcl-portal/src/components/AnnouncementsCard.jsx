// Props: { announcements?: Array<{id: string, title: string, content: string, timestamp: string}> }

// Displays announcements in a scrollable list with headings and timestamps
export default function AnnouncementsCard({ announcements = [] }) {
  // Mock announcements data matching Figma design
  const mockAnnouncements = [
    {
      id: 1,
      title: "This feature will be available soon",
      content: "",
      timestamp: "Digital Services Team"
    }
  ];

  const displayAnnouncements = announcements.length > 0 ? announcements : mockAnnouncements;

  return (
    <div className="bg-cranberry/10 border border-cranberry rounded-lg max-h-[700px] min-h-[420px] overflow-y-hidden ">
      <div className="p-6">
        <h2 className="text-xl font-normal text-cranberry text-center mb-6">Announcements</h2>
        
        <div className="space-y-6 max-h-[600px] overflow-y-auto hide-scrollbar">
          {displayAnnouncements.map((announcement) => (
            <div key={announcement.id} className="bg-black/50 rounded-lg p-4">
              <h3 className="text-white font-semibold text-sm mb-2">{announcement.title}</h3>
              <p className="text-white text-sm leading-relaxed mb-3 overflow-hidden">
                {announcement.content.length > 150 ? announcement.content.substring(0, 150) + '...' : announcement.content}
              </p>
              <div className="text-white/50 text-xs">
                {announcement.timestamp}
              </div>
            </div>
          ))}
        </div>
        
        {displayAnnouncements.length === 0 && (
          <div className="text-center text-white/50 py-8">
            No announcements available
          </div>
        )}
      </div>
    </div>
  );
}