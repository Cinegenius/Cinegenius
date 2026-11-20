import signal
import subprocess
import sys
import unittest

import publisher


class ProcessTests(unittest.TestCase):
    def test_completed_reviewer_returns_exit_status(self):
        process=subprocess.Popen([sys.executable,'-c','pass'],start_new_session=True)
        previous=signal.getsignal(signal.SIGTERM)
        self.assertEqual(publisher.wait_child(process,2),0)
        self.assertEqual(signal.getsignal(signal.SIGTERM),previous)

    def test_timeout_stops_actual_isolated_child_and_restores_handler(self):
        process=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)'],start_new_session=True)
        previous=signal.getsignal(signal.SIGTERM)
        with self.assertRaises(ValueError):publisher.wait_child(process,.05)
        self.assertIsNotNone(process.poll())
        self.assertEqual(signal.getsignal(signal.SIGTERM),previous)


if __name__=='__main__':unittest.main()
