import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Props: { isOpen: boolean, onClose: function, onConfirm: function, isAwarding: boolean, standings: array }
export default function AwardPointsDialog({ isOpen, onClose, onConfirm, isAwarding, standings }) {
  const topThree = standings.filter(s => s.place >= 1 && s.place <= 3);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-black/50 backdrop-blur-lg border border-cranberry/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Award Tournament Points</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Are you sure you want to award points to the following teams? This action will update their tournament standings.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-2">
          {topThree.map((standing) => (
            <div 
              key={standing.club_id}
              className="flex justify-between items-center p-3 rounded-lg bg-black/50 border border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center font-bold
                  ${standing.place === 1 ? 'bg-yellow-500 text-gray-900' : ''}
                  ${standing.place === 2 ? 'bg-gray-400 text-gray-900' : ''}
                  ${standing.place === 3 ? 'bg-amber-700 text-white' : ''}
                `}>
                  {standing.place}
                </div>
                <span className="text-white font-medium">{standing.club_name}</span>
              </div>
              <span className="text-green-400 font-semibold">{standing.points} pts</span>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={isAwarding}
            className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isAwarding}
            className="bg-cranberry/60 hover:bg-cranberry text-white cursor-pointer"
          >
            {isAwarding ? 'Awarding...' : 'Confirm & Award'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
