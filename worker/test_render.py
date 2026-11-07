import unittest
from render import keep_segments

class KeepSegmentsTest(unittest.TestCase):
    def test_complement_and_human_keep(self):
        self.assertEqual(keep_segments(120,[{'start_s':0,'end_s':15,'keep':False},{'start_s':55,'end_s':70,'keep':False},{'start_s':90,'end_s':100,'keep':True}]),[(15,55),(70,120)])
    def test_overlap_is_unioned(self):
        self.assertEqual(keep_segments(60,[{'start_s':10,'end_s':30},{'start_s':20,'end_s':40}]),[(0,10),(40,60)])
    def test_reject_all_and_invalid_cuts(self):
        for cuts in [[{'start_s':0,'end_s':60}],[{'start_s':-1,'end_s':5}],[{'start_s':0,'end_s':float('nan')}]]:
            with self.assertRaises(ValueError):keep_segments(60,cuts)

if __name__=='__main__':unittest.main()
